// covers: file:core/tools/aidlc-stage-refresh-contract.ts, file:core/tools/aidlc-refresh-compatibility.ts, function:pendingRequestCurrency
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { sha256File, walkFiles } from "../../core/tools/aidlc-distribution.ts";
import { planCompatibleRefresh, type CompatibleRefreshValidation } from "../../core/tools/aidlc-refresh-compatibility.ts";
import { executePlan, writeOperation, type TransactionPlan } from "../../core/tools/aidlc-transaction.ts";
import { hermeticGitEnvironment } from "../../plugins/rin/tools/hermetic-git/index.ts";

const repositoryRoot = resolve(import.meta.dir, "../..");
const ownedRoots = new Set<string>();
afterEach(() => {
  [...ownedRoots].forEach((root) => { rmSync(root, { recursive: true, force: true }); });
  ownedRoots.clear();
});
const put = (args: { readonly root: string; readonly path: string; readonly content: string }): void => {
  mkdirSync(dirname(join(args.root, args.path)), { recursive: true });
  writeFileSync(join(args.root, args.path), args.content);
};
const oldSensor = {
  id: "required-sections", path: ".claude/sensors/aidlc-required-sections.md", fire_on: "gate",
  default_severity: "advisory", category: "document-shape", matches: "**/{aidlc-docs,intents}/**",
};
const oldStage = {
  slug: "work", mode: "inline", guard_policy: "strict", approval_mode: "explicit",
  produces: ["facts"], reviewer: "fixture-reviewer", rules_in_context: [{ path: "aidlc/spaces/default/memory/team.md", scope: "team" }],
  sensors: ["required-sections"], sensors_applicable: [oldSensor],
};
const originalOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved)";
const engineOutputs = "application code + code-generation-plan.md, code-generation-questions.md, unit-test-instructions.md, code-summary.md, traceability.json (under this stage's per-unit record dir, engine-resolved; the engine writes code-generation-questions.md)";
// biome-ignore lint/suspicious/noExportsInTest: CD-7a requires exported owned fixture types.
export type SemanticRefreshFixture = {
  readonly root: string;
  readonly projectDir: string;
  readonly sourceRoot: string;
  readonly plan: TransactionPlan;
};
const fixture = (): SemanticRefreshFixture => {
  const root = mkdtempSync(join(tmpdir(), "aidlc-semantic-refresh-")); ownedRoots.add(root);
  const projectDir = join(root, "project"); const sourceRoot = join(root, "source");
  [projectDir, sourceRoot].forEach((dir) => {
    put({ root: dir, path: ".claude/tools/aidlc-lib.ts", content: 'export const CURRENT_STATE_VERSION = "8";\n' });
    put({ root: dir, path: ".claude/tools/data/stage-graph.json", content: JSON.stringify([oldStage]) });
    put({ root: dir, path: ".claude/tools/data/scope-grid.json", content: '{"feature":{"stages":{"work":"EXECUTE"},"guard_policy":"strict"}}' });
  });
  put({ root: projectDir, path: ".claude/tools/payload.ts", content: "original payload\n" });
  put({ root: projectDir, path: "aidlc/spaces/default/intents/backlog/aidlc-state.md", content: "- **Status**: Running\n- **Current Stage**: work\n" });
  put({ root: projectDir, path: "aidlc/spaces/default/intents/backlog/audit.md", content: "Historical earned evidence at its actual source.\n" });
  put({ root: projectDir, path: "aidlc/spaces/other/intents/parked/aidlc-state.md", content: "- **Status**: Running\n- **Parked**: backlog\n" });
  put({ root: projectDir, path: "aidlc/spaces/default/intents/backlog/construction/code-generation/code-generation-questions.md", content: "## Plan Approval\nA. Approve Plan\n[Answer]: Approve Plan\nOriginal person words.\r\n" });
  const plan: TransactionPlan = { schemaVersion: 1, root: projectDir,
    operations: [writeOperation(".claude/tools/payload.ts", "updated payload\n", sha256File(join(projectDir, ".claude/tools/payload.ts")))] };
  return { root, projectDir, sourceRoot, plan };
};
const validate = (f: SemanticRefreshFixture): CompatibleRefreshValidation =>
  planCompatibleRefresh({ projectDir: f.projectDir, sourceRoot: f.sourceRoot, harnessDir: ".claude", plan: f.plan });
const stageGraph = (args: { readonly root: string; readonly stage: Readonly<Record<string, unknown>> }): void =>
  put({ root: args.root, path: ".claude/tools/data/stage-graph.json", content: JSON.stringify([args.stage]) });
const workspace = (f: SemanticRefreshFixture): Readonly<Record<string, string>> =>
  Object.fromEntries(walkFiles(join(f.projectDir, "aidlc")).map((path) => [path, sha256File(join(f.projectDir, "aidlc", path))]));
const apply = (f: SemanticRefreshFixture): unknown => {
  const result = validate(f);
  if (result.kind !== "planned") throw new Error(result.message);
  return executePlan(f.plan, { validateLocked: result.validateLocked });
};

describe("semantic compatibility at the real transaction boundary", () => {
  test("additive sensor coverage refreshes payload without changing backlog, questions or historical evidence", () => {
    const f = fixture(); const before = workspace(f);
    stageGraph({ root: f.sourceRoot, stage: { ...oldStage, sensors_applicable: [{ ...oldSensor, matches: "**/{aidlc-docs,intents,codekb}/**" }] } });
    expect(validate(f)).toMatchObject({ kind: "planned", evidence: { stageRevalidation: { work: ["gate-sensor-coverage"] } } });
    apply(f);
    expect(readFileSync(join(f.projectDir, ".claude/tools/payload.ts"), "utf8")).toBe("updated payload\n");
    expect(workspace(f)).toEqual(before);
  });
  test("the exact engine questions clarification preserves raw answered questions", () => {
    const f = fixture(); const before = workspace(f);
    stageGraph({ root: f.projectDir, stage: { ...oldStage, slug: "code-generation", outputs: originalOutputs } });
    stageGraph({ root: f.sourceRoot, stage: { ...oldStage, slug: "code-generation", outputs: engineOutputs } });
    expect(validate(f)).toMatchObject({ kind: "planned", evidence: { stageRevalidation: { "code-generation": ["plan-approval-questions"] } } });
    apply(f);
    expect(workspace(f)).toEqual(before);
  });
  test("a runtime timeout payload change does not invalidate recorded contract evidence", () => {
    const f = fixture(); const before = workspace(f);
    put({ root: f.projectDir, path: ".claude/sensors/aidlc-required-sections.md", content: "timeout: 5\n" });
    const plan: TransactionPlan = { ...f.plan, operations: [writeOperation(".claude/sensors/aidlc-required-sections.md", "timeout: 300\n", sha256File(join(f.projectDir, ".claude/sensors/aidlc-required-sections.md")))] };
    const result = planCompatibleRefresh({ projectDir: f.projectDir, sourceRoot: f.sourceRoot, harnessDir: ".claude", plan });
    expect(result).toMatchObject({ kind: "planned", evidence: { stageRevalidation: {} } });
    applyPrepared({ fixture: { ...f, plan }, result });
    expect(readFileSync(join(f.projectDir, ".claude/sensors/aidlc-required-sections.md"), "utf8")).toBe("timeout: 300\n");
    expect(workspace(f)).toEqual(before);
  });
  test.each([
    { stage: { ...oldStage, sensors_applicable: [{ ...oldSensor, matches: "**/intents/**" }] } },
    { stage: { ...oldStage, sensors_applicable: [{ ...oldSensor, matches: "**/{aidlc-docs,intents,*}/**" }] } },
    { stage: { ...oldStage, sensors_applicable: [{ ...oldSensor, path: ".claude/sensors/unowned.md", matches: "**/{aidlc-docs,intents,codekb}/**" }] } },
    { stage: { ...oldStage, sensors_applicable: [{ ...oldSensor, category: "different", matches: "**/{aidlc-docs,intents,codekb}/**" }] } },
    { stage: { ...oldStage, sensors_applicable: [{ ...oldSensor, default_severity: "blocking", matches: "**/{aidlc-docs,intents,codekb}/**" }] } },
    { stage: { ...oldStage, sensors: [], sensors_applicable: [] } },
    { stage: { ...oldStage, guard_policy: "relaxed" } },
    { stage: { ...oldStage, approval_mode: "none" } },
    { stage: { ...oldStage, produces: [] } },
    { stage: { ...oldStage, reviewer: "different" } },
    { stage: { ...oldStage, rules_in_context: [] } },
    { stage: { ...oldStage, outputs: "Unrecognized writer or output obligations" } },
  ])("refuses destructive or unproved semantics %# before payload writes", ({ stage }) => {
    const f = fixture(); const before = workspace(f);
    stageGraph({ root: f.sourceRoot, stage });
    expect(validate(f)).toMatchObject({ kind: "refused", reason: "stage-contract-changed" });
    expect(readFileSync(join(f.projectDir, ".claude/tools/payload.ts"), "utf8")).toBe("original payload\n");
    expect(workspace(f)).toEqual(before);
  });
  test("refuses a writer field even alongside the exact approved questions clause", () => {
    const f = fixture();
    stageGraph({ root: f.projectDir, stage: { ...oldStage, slug: "code-generation", outputs: originalOutputs } });
    stageGraph({ root: f.sourceRoot, stage: { ...oldStage, slug: "code-generation", outputs: engineOutputs, questions_writer: "model" } });
    expect(validate(f)).toMatchObject({ kind: "refused", reason: "stage-contract-changed" });
  });
  test("refuses any questions deletion through the existing workspace boundary", () => {
    const f = fixture();
    const plan: TransactionPlan = { ...f.plan, operations: [{ kind: "remove", path: "aidlc/spaces/default/intents/backlog/construction/code-generation/code-generation-questions.md", expected: sha256File(join(f.projectDir, "aidlc/spaces/default/intents/backlog/construction/code-generation/code-generation-questions.md")) }] };
    expect(planCompatibleRefresh({ projectDir: f.projectDir, sourceRoot: f.sourceRoot, harnessDir: ".claude", plan })).toMatchObject({ kind: "refused", reason: "workspace-write" });
  });
  test("binds accepted additive metadata changes again under the existing transaction lock", () => {
    const f = fixture();
    stageGraph({ root: f.sourceRoot, stage: { ...oldStage, sensors_applicable: [{ ...oldSensor, matches: "**/{aidlc-docs,intents,codekb}/**" }] } });
    const result = validate(f);
    expect(result.kind).toBe("planned");
    stageGraph({ root: f.sourceRoot, stage: { ...oldStage, guard_policy: "relaxed" } });
    expect(applyPrepared({ fixture: f, result })).toMatchObject({ kind: "refused", reason: "inputs-changed" });
    expect(readFileSync(join(f.projectDir, ".claude/tools/payload.ts"), "utf8")).toBe("original payload\n");
  });
});
const applyPrepared = (args: { readonly fixture: SemanticRefreshFixture; readonly result: CompatibleRefreshValidation }): unknown => {
  if (args.result.kind !== "planned") throw new Error(args.result.message);
  return executePlan(args.fixture.plan, { validateLocked: args.result.validateLocked });
};

const ownerProbe = (args: { readonly source: string }): unknown => {
  const f = fixture(); const home = join(f.root, "home"); mkdirSync(home);
  cpSync(join(repositoryRoot, "dist-release/claude"), f.projectDir, { recursive: true });
  const probe = join(f.root, "owner-probe.ts"); writeFileSync(probe, args.source);
  const env = {
    ...hermeticGitEnvironment({ configHome: home, ambient: { PATH: process.env.PATH } }),
    XDG_CONFIG_HOME: join(home, "config"), XDG_CACHE_HOME: join(home, "cache"), TMPDIR: f.root,
    AIDLC_HARNESS_DIR: ".claude", AIDLC_HARNESS_NAME: "claude", AIDLC_PROJECT_DIR: f.projectDir, CLAUDE_PROJECT_DIR: f.projectDir,
    AIDLC_STAGE_GRAPH: join(f.projectDir, ".claude/tools/data/stage-graph.json"),
    AIDLC_SCOPE_GRID: join(f.projectDir, ".claude/tools/data/scope-grid.json"),
  };
  const result = spawnSync(process.execPath, [probe, f.projectDir, repositoryRoot], { cwd: f.projectDir, env, encoding: "utf8", timeout: 60_000 });
  if (result.status !== 0 || result.error) throw new Error(result.stdout + result.stderr + String(result.error ?? ""));
  return JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "{}");
};

test("actual artifact edits stale only their own request currency and preserve unrelated binding identifiers", () => {
  expect(ownerProbe({ source: `
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
const pd = process.argv[2]; const repo = process.argv[3];
const { createIntent, reviewArtifactFingerprint, pendingRequestCurrency } = await import(join(repo, "core/tools/aidlc-lib.ts"));
const created = createIntent(pd, "owned freshness proof", "default", "poc");
const stage = { slug: "code-generation", phase: "construction", produces: ["code-generation-plan"], review_artifact: "code-generation-plan" };
const other = { slug: "requirements-analysis", phase: "inception", produces: ["requirements"], review_artifact: "requirements" };
const planPath = join(created.recordDir, "construction/code-generation/code-generation-plan.md");
const otherPath = join(created.recordDir, "inception/requirements-analysis/requirements.md");
[planPath, otherPath].forEach((path) => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, "Reviewed original artifact.\\n"); });
const binding = (item) => ({ artifactFingerprint: reviewArtifactFingerprint(pd, item), requestId: "review:" + "1".repeat(32), legacyAppendix: null, sourceFingerprint: null, unitSourceFingerprint: null, recoveryCause: null });
const first = binding(stage); const second = binding(other);
const before = [pendingRequestCurrency(pd, stage, undefined, first), pendingRequestCurrency(pd, other, undefined, second)];
writeFileSync(planPath, "Actually changed declared plan.\\n");
console.log(JSON.stringify({ before, affected: pendingRequestCurrency(pd, stage, undefined, first), unaffected: pendingRequestCurrency(pd, other, undefined, second), untouchedArtifact: readFileSync(otherPath, "utf8"), unaffectedRequestId: second.requestId }));
` })).toMatchObject({
    before: [{ requestCurrent: true }, { requestCurrent: true }],
    affected: { requestCurrent: false, readable: true }, unaffected: { requestCurrent: true, readable: true },
    untouchedArtifact: "Reviewed original artifact.\n", unaffectedRequestId: "review:11111111111111111111111111111111",
  });
});


test("genuine retained conductor questions remain answerable, prompt-bound and protected from engine replacement", () => {
  expect(ownerProbe({ source: String.raw`
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const pd = process.argv[2]; const repo = process.argv[3];
const lib = await import(join(repo, "core/tools/aidlc-lib.ts"));
const posture = await import(join(repo, "core/tools/aidlc-testing-posture.ts"));
const ask = await import(join(repo, "core/tools/aidlc-plan-approval-ask.ts"));
const { appendAuditEntry } = await import(join(repo, "core/tools/aidlc-audit.ts"));
const created = lib.createIntent(pd, "legacy question proof", "default", "poc");
const state = "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: poc\n- **Project Type**: Brownfield\n- **Test Strategy**: Minimal\n- **Depth**: Minimal\n- **Guard Policy**: strict (set by you)\n- **Plan Approval**: on (set by you)\n- **Current Stage**: code-generation\n- **Status**: Running\n## Stage Progress\n### CONSTRUCTION PHASE\n- [-] code-generation — EXECUTE\n";
writeFileSync(join(created.recordDir, "aidlc-state.md"), state);
mkdirSync(join(pd, "src"), { recursive: true }); writeFileSync(join(pd, "src/base.ts"), "export const base = true;\n");
const run = (tool, args, input) => {
  const result = spawnSync(process.execPath, [join(repo, "core/tools", tool), ...args], { cwd: pd, env: process.env, input, encoding: "utf8", timeout: 30000 });
  return { code: result.status, text: result.stdout + result.stderr };
};
const git = (args) => {
  const result = spawnSync("git", args, { cwd: pd, env: process.env, encoding: "utf8", timeout: 30000 });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
};
[["init","-q"],["config","user.email","fixture@example.test"],["config","user.name","Owned fixture"],["add","-A"],["commit","-qm","owned baseline"]].forEach(git);
lib.writeActiveDirectiveMarker(pd, { kind: "run-stage", stage: "code-generation", state_sha256: lib.stateDigest(state) });
const dir = posture.codeGenerationRecordDir(pd, null); mkdirSync(dir, { recursive: true });
const planPath = join(dir, "code-generation-plan.md"); const questionPath = join(dir, "code-generation-questions.md");
writeFileSync(planPath, "# Plan\n\n" + posture.renderTestingContract(posture.resolveTestingPosture(pd)) + "\n## Steps\n- [ ] Implement base\n");
writeFileSync(join(dir, "unit-test-instructions.md"), "# Unit Test Instructions\nRun bun test src/base.test.ts.\n");
writeFileSync(questionPath, "## Plan Approval\n[Answer]:\n");
const fp = run("aidlc-testing-posture.ts", ["fingerprint","--stage-level","--project-dir",pd]);
if (fp.code !== 0) throw new Error(fp.text);
writeFileSync(questionPath, "## Plan Approval\n" + fp.text.trim() + "\nA. Approve Plan\nB. Request Changes\n[Answer]:\n");
const session = "01995000-7a11-7000-8000-000000000041";
appendAuditEntry("SESSION_STARTED", { Source: "startup", Session: session }, pd);
const identity = ["--stage","code-generation","--checkpoint","plan-approval","--questions-file",questionPath,"--session",session,"--stage-level","--project-dir",pd];
const decision = run("aidlc-log.ts", ["decision",...identity,"--decision","Approve this exact Code Generation plan?","--options","Approve Plan,Request Changes"]);
if (decision.code !== 0) throw new Error(decision.text);
const beforeQuestion = readFileSync(questionPath, "utf8");
const pending = posture.legacyPlanApprovalQuestionState({ projectDir: pd, target: { unit: null } });
appendAuditEntry("SESSION_STARTED", { Source: "startup", Session: "01995000-7a11-7000-8000-000000000042" }, pd);
const origin = posture.legacyPlanApprovalQuestionState({ projectDir: pd, target: { unit: null } });
const directive = { kind: "run-stage", stage: "code-generation", phase: "construction", lead_agent: "aidlc-developer-agent", support_agents: [], mode: "inline", inline_context_paths: [], gate: false };
const route = ask.routeCodeGenerationPlanApproval(pd, directive);
const keptByRoute = readFileSync(questionPath, "utf8") === beforeQuestion;
const conflictingAsk = { kind: "ask", ask_type: "plan-approval", response_route: "next", stage: "code-generation", question: "Replacement question", plan_approval: { targets: [{ unit: null }], choices: ["Approve Plan","Request Changes"], editing: false } };
let writerRefused = false;
try { ask.publishPlanApprovalAsk(pd, conflictingAsk); } catch { writerRefused = true; }
const keptByWriter = readFileSync(questionPath, "utf8") === beforeQuestion;
rmSync(questionPath);
const missingPending = posture.legacyPlanApprovalQuestionState({ projectDir: pd, target: { unit: null } });
const missingPendingRoute = ask.routeCodeGenerationPlanApproval(pd, { ...directive });
const corruptPath = lib.planApprovalRuntimeFile(pd, "challenge-unreadable-fixture.json");
writeFileSync(corruptPath, "{");
const corruptRoute = ask.routeCodeGenerationPlanApproval(pd, { ...directive });
let unknownChallengeRefused = false;
try { ask.withPlanApprovalAskPublication({ projectDir: pd, directive: conflictingAsk, publish: () => { throw new Error("publication must not run"); } }); }
catch (error) { unknownChallengeRefused = String(error).includes("Cannot establish retained Plan Approval challenge identity"); }
rmSync(corruptPath);
writeFileSync(questionPath, beforeQuestion);
const human = run("aidlc.ts", ["engine","hook","record-human-turn"], JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: session, prompt: "Approve Plan" }));
if (human.code !== 0) throw new Error(human.text);
writeFileSync(questionPath, beforeQuestion.replace(/^\[Answer\]:.*$/m, "[Answer]: Approve Plan"));
const answered = run("aidlc-log.ts", ["answer",...identity,"--details","Approve Plan"]);
if (answered.code !== 0) throw new Error(answered.text);
const valid = posture.evaluateCodeGenerationApproval(pd, { unit: null });
const approvedQuestion = readFileSync(questionPath, "utf8");
writeFileSync(questionPath, approvedQuestion + "\nDifferent prompt obligation.\n");
const promptChanged = posture.evaluateCodeGenerationApproval(pd, { unit: null });
writeFileSync(questionPath, approvedQuestion); rmSync(questionPath);
const missing = posture.legacyPlanApprovalQuestionState({ projectDir: pd, target: { unit: null } });
const missingApproval = posture.evaluateCodeGenerationApproval(pd, { unit: null });
const missingLegacyRoute = ask.routeCodeGenerationPlanApproval(pd,{...directive});
const receiptEvidence = lib.readPlanApprovalReceiptsForTarget({projectDir:pd,intentId:lib.activeIntentUuid(pd),targetId:posture.codeGenerationTargetId({unit:null})});
if (receiptEvidence.length === 0) throw new Error("Genuine retained approval receipt required.");
const receiptRoot = join(lib.planApprovalRuntimeFile(pd,"probe"),"..");
const receiptPath = join(receiptRoot,readdirSync(receiptRoot).find((name)=>name.startsWith("receipt-") &&
  JSON.parse(readFileSync(join(receiptRoot,name),"utf8")).fingerprint === receiptEvidence[0].fingerprint));
const receiptBytes = readFileSync(receiptPath,"utf8");
const openQuestionPath = lib.planApprovalRuntimeFile(pd,"open-engine-question.json");
const retainedOpenQuestion = existsSync(openQuestionPath) ? readFileSync(openQuestionPath,"utf8") : null;
lib.clearActiveDirectiveMarker(pd);
let missingMarkerPublicationRefused = false;
try { ask.withPlanApprovalAskPublication({projectDir:pd,directive:conflictingAsk,publish:()=>{throw new Error("publication must not run");}}); }
catch (error) { missingMarkerPublicationRefused = String(error).includes("Cannot replace a retained Plan Approval question"); }
const missingMarkerEvidencePreserved = missingMarkerPublicationRefused &&
  lib.readActiveDirectiveMarker(pd,state) === null && !existsSync(questionPath) &&
  readFileSync(receiptPath,"utf8") === receiptBytes &&
  (existsSync(openQuestionPath) ? readFileSync(openQuestionPath,"utf8") : null) === retainedOpenQuestion;
const corruptReceiptPath = lib.planApprovalRuntimeFile(pd,"receipt-unknown-fixture.json");
writeFileSync(corruptReceiptPath,JSON.stringify({version:2}));
let unknownReceiptRefused = false;
try { ask.withPlanApprovalAskPublication({projectDir:pd,directive:conflictingAsk,publish:()=>{throw new Error("publication must not run");}}); }
catch (error) { unknownReceiptRefused = String(error).includes("Cannot establish retained Plan Approval receipt identity"); }
rmSync(corruptReceiptPath);
lib.writeActiveDirectiveMarker(pd,{kind:"run-stage",stage:"code-generation",state_sha256:lib.stateDigest(state)});
writeFileSync(questionPath, approvedQuestion);
const modern = lib.createIntent(pd, "engine question proof", "default", "poc");
writeFileSync(join(modern.recordDir, "aidlc-state.md"), state);
lib.writeActiveDirectiveMarker(pd, { kind: "run-stage", stage: "code-generation", state_sha256: lib.stateDigest(state) });
const modernDir = posture.codeGenerationRecordDir(pd, null); mkdirSync(modernDir, { recursive: true });
writeFileSync(join(modernDir, "code-generation-plan.md"), "# Plan\n\n" + posture.renderTestingContract(posture.resolveTestingPosture(pd)) + "\n## Steps\n- [ ] Implement base\n");
writeFileSync(join(modernDir, "unit-test-instructions.md"), "# Unit Test Instructions\nRun bun test src/base.test.ts.\n");
const modernRoute = ask.routeCodeGenerationPlanApproval(pd, { ...directive });
if (modernRoute.kind !== "ask") throw new Error(JSON.stringify(modernRoute));
const previousMarker = lib.readActiveDirectiveMarker(pd, state);
const retainedPath = join(modernDir, "code-generation-questions.md");
const unknownWords = "## Plan Approval\nAn existing plan question in the person's words.\nA. Approve Plan\nB. Request Changes\n[Answer]:\n";
writeFileSync(retainedPath, unknownWords);
let boundaryRefused = false;
try {
  ask.withPlanApprovalAskPublication({ projectDir: pd, directive: modernRoute, publish: () => {
    lib.writeActiveDirectiveMarker(pd, { kind: "ask", ask_type: "plan-approval", stage: "code-generation", state_sha256: lib.stateDigest(state) });
    ask.noteOpenEngineQuestion(pd, { ask_type: "plan-approval", state_sha256: lib.stateDigest(state) });
    ask.publishPlanApprovalAsk(pd, modernRoute);
  } });
} catch { boundaryRefused = true; }
const boundaryKept = JSON.stringify(lib.readActiveDirectiveMarker(pd, state)) === JSON.stringify(previousMarker) &&
  lib.readPlanApprovalRuntimeRecord(lib.planApprovalRuntimeFile(pd, "open-engine-question.json"), "Open engine question") === null &&
  readFileSync(retainedPath, "utf8") === unknownWords;
const unknownRoute = ask.routeCodeGenerationPlanApproval(pd, { ...directive });
const unknownFp = run("aidlc-testing-posture.ts", ["fingerprint","--stage-level","--project-dir",pd]);
if (unknownFp.code !== 0) throw new Error(unknownFp.text);
writeFileSync(retainedPath, unknownWords.replace("A. Approve Plan", unknownFp.text.trim() + "\nA. Approve Plan"));
const unknownIdentity = ["--stage","code-generation","--checkpoint","plan-approval","--questions-file",retainedPath,"--session",session,"--stage-level","--project-dir",pd];
const unknownDecision = run("aidlc-log.ts", ["decision",...unknownIdentity,"--decision","Approve this retained exact plan?","--options","Approve Plan,Request Changes"]);
if (unknownDecision.code !== 0) throw new Error(unknownDecision.text);
const unknownHuman = run("aidlc.ts", ["engine","hook","record-human-turn"], JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: session, prompt: "Approve Plan" }));
if (unknownHuman.code !== 0) throw new Error(unknownHuman.text);
writeFileSync(retainedPath, readFileSync(retainedPath,"utf8").replace(/^\[Answer\]:.*$/m, "[Answer]: Approve Plan"));
const unknownAnswer = run("aidlc-log.ts", ["answer",...unknownIdentity,"--details","Approve Plan"]);
if (unknownAnswer.code !== 0) throw new Error(unknownAnswer.text);
const unknownRecovered = posture.evaluateCodeGenerationApproval(pd, { unit: null }).ok &&
  ask.routeCodeGenerationPlanApproval(pd, { ...directive }).plan_approval?.status === "approved" &&
  readFileSync(retainedPath,"utf8").includes("An existing plan question in the person's words.");
const engine = lib.createIntent(pd, "fresh engine question proof", "default", "poc");
writeFileSync(join(engine.recordDir,"aidlc-state.md"), state);
lib.clearActiveDirectiveMarker(pd);
const engineDir = posture.codeGenerationRecordDir(pd, null); mkdirSync(engineDir, { recursive: true });
["code-generation-plan.md","unit-test-instructions.md"].forEach((name) => writeFileSync(join(engineDir,name), readFileSync(join(modernDir,name))));
const firstIssuance = ask.routeCodeGenerationPlanApproval(pd, { ...directive });
const firstIssuanceAllowed = firstIssuance.kind === "ask";
lib.writeActiveDirectiveMarker(pd, { kind: "run-stage", stage: "code-generation", state_sha256: lib.stateDigest(state) });
const engineRoute = ask.routeCodeGenerationPlanApproval(pd, { ...directive });
if (engineRoute.kind !== "ask") throw new Error(JSON.stringify(engineRoute));
ask.withPlanApprovalAskPublication({ projectDir: pd, directive: engineRoute, publish: () => {
  lib.writeActiveDirectiveMarker(pd, { kind: "ask", ask_type: "plan-approval", stage: "code-generation", state_sha256: lib.stateDigest(state) });
  ask.noteOpenEngineQuestion(pd, { ask_type: "plan-approval", state_sha256: lib.stateDigest(state) });
  ask.publishPlanApprovalAsk(pd, engineRoute);
} });
const modernQuestions = join(engineDir, "code-generation-questions.md");
const beforeModern = readFileSync(modernQuestions, "utf8");
const unchangedRecord = ask.readPlanApprovalAsk(pd,lib.activeIntentUuid(pd));
ask.withPlanApprovalAskPublication({ projectDir: pd,directive:engineRoute,publish:()=>ask.publishPlanApprovalAsk(pd,engineRoute) });
const unchangedReask = ask.readPlanApprovalAsk(pd,lib.activeIntentUuid(pd)).askId === unchangedRecord.askId &&
  readFileSync(modernQuestions,"utf8") === beforeModern;
const writtenAnswer = beforeModern.replace(/^\[Answer\]:.*$/m,"[Answer]: The person's exact pending words.");
writeFileSync(modernQuestions,writtenAnswer);
ask.withPlanApprovalAskPublication({ projectDir:pd,directive:engineRoute,publish:()=>ask.publishPlanApprovalAsk(pd,engineRoute) });
const answerOnlyKept = readFileSync(modernQuestions,"utf8") === writtenAnswer;
writeFileSync(modernQuestions,writtenAnswer+"\nExtra prompt obligation with the same tag.\n");
const changedModern = readFileSync(modernQuestions,"utf8");
const modernPromptRoute = ask.routeCodeGenerationPlanApproval(pd,{...directive});
let modernPromptWriterRefused = false;
try { ask.withPlanApprovalAskPublication({projectDir:pd,directive:engineRoute,publish:()=>ask.publishPlanApprovalAsk(pd,engineRoute)}); } catch { modernPromptWriterRefused = true; }
const modernPromptKept = readFileSync(modernQuestions,"utf8") === changedModern;
writeFileSync(modernQuestions,beforeModern);
const forbiddenFingerprint = run("aidlc-testing-posture.ts", ["fingerprint","--stage-level","--project-dir",pd]);
const forbiddenDecision = run("aidlc-log.ts", ["decision",...["--stage","code-generation","--checkpoint","plan-approval","--questions-file",modernQuestions,"--session",session,"--stage-level","--project-dir",pd],"--decision","Competing question?","--options","Approve Plan,Request Changes"]);
const engineWriterExclusive = forbiddenFingerprint.code !== 0 && forbiddenDecision.code !== 0 && readFileSync(modernQuestions, "utf8") === beforeModern;
rmSync(modernQuestions);
const missingModernRoute = ask.routeCodeGenerationPlanApproval(pd, { ...directive });
let missingModernWriterRefused = false;
try { ask.publishPlanApprovalAsk(pd, engineRoute); } catch { missingModernWriterRefused = true; }
const missingModernNotRecreated = !existsSync(modernQuestions);
writeFileSync(modernQuestions,beforeModern);
const enginePlanPath = join(engineDir,"code-generation-plan.md");
writeFileSync(enginePlanPath,readFileSync(enginePlanPath,"utf8")+"\n- [ ] Legitimate plan amendment before the person's approval.\n");
const modernHuman = run("aidlc.ts",["engine","hook","record-human-turn"],JSON.stringify({hook_event_name:"UserPromptSubmit",session_id:session,prompt:"Approve Plan"}));
if (modernHuman.code !== 0) throw new Error(modernHuman.text);
ask.recordPlanApprovalAnswer(pd,session,{choice:"approve",exactPick:true});
const modernApproval = posture.evaluateCodeGenerationApproval(pd,{unit:null});
const modernApproved = modernApproval.ok && modernApproval.receiptValid &&
  ask.routeCodeGenerationPlanApproval(pd,{...directive}).plan_approval?.status === "approved";
writeFileSync(enginePlanPath,readFileSync(enginePlanPath,"utf8")+"\n- [ ] A later amendment requires a fresh approval.\n");
const amendedRoute = ask.routeCodeGenerationPlanApproval(pd,{...directive});
if (amendedRoute.kind !== "ask") throw new Error(JSON.stringify(amendedRoute));
ask.withPlanApprovalAskPublication({projectDir:pd,directive:amendedRoute,publish:()=>ask.publishPlanApprovalAsk(pd,amendedRoute)});
const modernAmendedReask = ask.readPlanApprovalAsk(pd,lib.activeIntentUuid(pd)).targets[0].promptSha256 !== undefined &&
  !posture.evaluateCodeGenerationApproval(pd,{unit:null}).ok;
const grouped = lib.createIntent(pd, "mixed unit ownership proof", "default", "feature");
writeFileSync(join(grouped.recordDir,"aidlc-state.md"), state.replace("Scope**: poc", "Scope**: feature"));
const groupedState = readFileSync(join(grouped.recordDir,"aidlc-state.md"),"utf8");
const dagPath = lib.runtimeGraphPath(pd); mkdirSync(join(dagPath,".."),{recursive:true});
writeFileSync(dagPath, JSON.stringify({ bolt_dag: { batches: [["unit-a","unit-b"]] } }));
lib.writeActiveDirectiveMarker(pd, { kind: "invoke-swarm", units: ["unit-a","unit-b"], stage: "code-generation", state_sha256: lib.stateDigest(groupedState) });
["unit-a","unit-b"].forEach((unit) => {
  const dir = posture.codeGenerationRecordDir(pd, unit); mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,"code-generation-plan.md"), "# Plan\n\n" + posture.renderTestingContract(posture.resolveTestingPosture(pd)) + "\n## Steps\n- [ ] Implement base\n");
  writeFileSync(join(dir,"unit-test-instructions.md"),readFileSync(join(engineDir,"unit-test-instructions.md")));
});
const routeA = ask.routeCodeGenerationPlanApproval(pd, { ...directive, unit: "unit-a" });
if (routeA.kind !== "ask") throw new Error(JSON.stringify(routeA));
ask.publishPlanApprovalAsk(pd, routeA);
const bPath = join(posture.codeGenerationRecordDir(pd, "unit-b"),"code-generation-questions.md");
writeFileSync(bPath, unknownWords);
const routeB = ask.routeCodeGenerationPlanApproval(pd, { ...directive, unit: "unit-b" });
let mixedWriterRefused = false;
try { ask.publishPlanApprovalAsk(pd, { ...routeA, plan_approval: { ...routeA.plan_approval, targets: [{ unit:"unit-b" }] } }); } catch { mixedWriterRefused = true; }
const mixedKept = readFileSync(bPath,"utf8") === unknownWords;
lib.writeActiveDirectiveMarker(pd, { kind: "invoke-swarm", units: ["unit-a","unit-b"], stage: "code-generation", state_sha256: lib.stateDigest(groupedState) });
const members = ["unit-a","unit-b"].map((unit) => {
  const questionsFile = join(posture.codeGenerationRecordDir(pd, unit),"code-generation-questions.md");
  const fingerprint = run("aidlc-testing-posture.ts", ["fingerprint","--unit",unit,"--project-dir",pd]);
  if (fingerprint.code !== 0) throw new Error(fingerprint.text);
  writeFileSync(questionsFile,"## Plan Approval\n" + fingerprint.text.trim() + "\nA. Approve Plan\nB. Request Changes\n[Answer]:\n");
  return { unit, questionsFile };
});
writeFileSync(join(grouped.recordDir,"retained-group.json"),JSON.stringify({ batch:"retained-group",units:members }));
const batchDecision = run("aidlc-log.ts", ["decision","--project-dir",pd,"--stage","code-generation","--checkpoint","plan-approval","--batch-file","retained-group.json","--session",session,"--decision","Approve these retained exact plans?","--options","Approve Plans,Request Changes"]);
if (batchDecision.code !== 0) throw new Error(batchDecision.text);
const batchBefore = members.map((member) => posture.legacyPlanApprovalQuestionState({ projectDir:pd,target:{unit:member.unit} }).kind);
writeFileSync(bPath,readFileSync(bPath,"utf8")+"\nChanged B prompt only.\n");
const batchAfter = members.map((member) => posture.legacyPlanApprovalQuestionState({ projectDir:pd,target:{unit:member.unit} }).kind);
console.log(JSON.stringify({ origin: { kind: origin.kind, session: origin.session }, batchBefore, batchAfter, missingMarkerEvidencePreserved, unknownReceiptRefused, missingLegacyRoute:missingLegacyRoute.plan_approval?.status, firstIssuanceAllowed, modernApproved, modernAmendedReask, unchangedReask, answerOnlyKept, modernPromptRoute:modernPromptRoute.plan_approval?.status, modernPromptWriterRefused, modernPromptKept, missingModernRoute: missingModernRoute.plan_approval?.status, missingModernWriterRefused, missingModernNotRecreated, corruptRoute: corruptRoute.plan_approval?.status, unknownChallengeRefused, boundaryRefused, boundaryKept, unknownRoute: unknownRoute.plan_approval?.status, unknownRecovered, mixedRoute: routeB.plan_approval?.status, mixedWriterRefused, mixedKept, missingPending: missingPending.kind, missingPendingRoute: missingPendingRoute.plan_approval?.status, engineWriterExclusive, pending: pending.kind, routeKind: route.kind, routeStatus: route.plan_approval?.status, keptByRoute, writerRefused, keptByWriter, valid: { ok: valid.ok, receiptValid: valid.receiptValid }, promptChanged: { ok: promptChanged.ok, receiptValid: promptChanged.receiptValid }, missing: missing.kind, missingApproved: missingApproval.ok }));
` })).toMatchObject({
    origin: { kind: "pending", session: "01995000-7a11-7000-8000-000000000041" },
    batchBefore: ["pending","pending"], batchAfter: ["pending","conflict"],
    missingMarkerEvidencePreserved:true, unknownReceiptRefused:true, missingLegacyRoute:"repair", firstIssuanceAllowed: true, modernApproved: true, modernAmendedReask: true, unchangedReask: true, answerOnlyKept: true, modernPromptRoute: "repair", modernPromptWriterRefused: true, modernPromptKept: true,
    missingModernRoute: "repair", missingModernWriterRefused: true, missingModernNotRecreated: true,
    corruptRoute: "repair", unknownChallengeRefused: true, boundaryRefused: true, boundaryKept: true, unknownRoute: "repair", unknownRecovered: true,
    mixedRoute: "repair", mixedWriterRefused: true, mixedKept: true,
    missingPending: "conflict", missingPendingRoute: "repair", engineWriterExclusive: true,
    pending: "pending", routeKind: "run-stage", routeStatus: "repair",
    keptByRoute: true, writerRefused: true, keptByWriter: true,
    valid: { ok: true, receiptValid: true }, promptChanged: { ok: false, receiptValid: false },
    missing: "conflict", missingApproved: false,
  });
}, 60_000);
