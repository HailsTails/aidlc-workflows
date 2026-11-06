// covers: function:stageParticipationPolicy, function:stageApprovalDirectiveFields,
// function:answerModeStageStartedFields, subcommand:aidlc-state:approve,
// subcommand:aidlc-state:reject, subcommand:aidlc-orchestrate:report
// The stage grant changes participation, never evidence or lifecycle obligations.
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateStageFrontmatter } from "../../core/tools/aidlc-stage-schema.ts";
import { appendAuditEntry } from "../../core/tools/aidlc-audit.ts";
import { stageParticipationPolicy } from "../../core/tools/aidlc-stage-participation.ts";
import type { StageApprovalMode } from "../../core/tools/aidlc-stage-participation.ts";
import {
  answerModeStageStartedFields, auditBlockField, emitStageFrontmatter, parseStageFrontmatter, readAuditShardEvents, stageApprovalDirectiveFields,
} from "../../core/tools/aidlc-lib.ts";
import {
  AIDLC_SRC, REPO_ROOT, cleanupTestProject, createTestProject, seedAidlcMemory,
  seedStateFile, seededRecordDir, seededStateFile,
} from "../harness/fixtures.ts";

const projects: string[] = [];
const SLUG = "feasibility";
afterEach(() => {
  for (const project of projects.splice(0)) cleanupTestProject(project);
});

describe("authored stage participation", () => {
  test("every Rin stage validates and round-trips its declared mode", () => {
    const files = [...new Bun.Glob("plugins/rin/stages/**/*.md").scanSync({ cwd: REPO_ROOT })];
    expect(files).toHaveLength(7);
    for (const file of files) {
      const frontmatter = parseStageFrontmatter(readFileSync(join(REPO_ROOT, file), "utf-8"));
      const result = validateStageFrontmatter(frontmatter);
      expect(result.valid, JSON.stringify(result)).toBe(true);
      expect(frontmatter.approval_mode).toBe("autonomous");
      expect(parseStageFrontmatter(emitStageFrontmatter(frontmatter)).approval_mode).toBe("autonomous");
      expect(validateStageFrontmatter({ ...frontmatter, approval_mode: "inferred" }).valid).toBe(false);
    }
  });
});

describe("stage participation is a pure policy", () => {
  test("an omitted mode remains human", () => {
    expect(stageParticipationPolicy()).toEqual({
      approvalMode: "human", routineQuestions: true, humanLearnings: true, autonomousApproval: false,
    });
  });
  test("only an authored stage grant removes routine interviews", () => {
    expect(stageParticipationPolicy({ approvalMode: "autonomous" })).toEqual({
      approvalMode: "autonomous", routineQuestions: false, humanLearnings: false, autonomousApproval: true,
    });
    expect(stageParticipationPolicy({ constructionGateAutonomous: true })).toMatchObject({
      routineQuestions: true, humanLearnings: true, autonomousApproval: true,
    });
  });
  test("reserved human gates override either grant", () => {
    for (const approvalMode of [undefined, "human", "autonomous"] as const) {
      expect(stageParticipationPolicy({
        approvalMode, constructionGateAutonomous: true, requireHuman: true,
      }).autonomousApproval).toBe(false);
    }
  });
  test("a reported person decision cannot borrow stage autonomy", () => {
    expect(stageParticipationPolicy({ approvalMode: "autonomous", personDecision: true }).autonomousApproval).toBe(false);
  });
  test("autonomous directive and audit projections invent no answer mode", () => {
    expect(stageApprovalDirectiveFields({ projectDir: null, approvalMode: "autonomous" }))
      .toEqual({ approval_mode: "autonomous" });
    expect(stageApprovalDirectiveFields({ projectDir: null })).toMatchObject({
      approval_mode: "human", answer_mode: { ask: true },
    });
    expect(answerModeStageStartedFields(null, { approvalMode: "autonomous" })).toEqual({});
  });
});

function fixture(mode: StageApprovalMode, options: { summary?: boolean; artifact?: boolean; reviewer?: boolean } = {}) {
  const project = createTestProject();
  projects.push(project);
  seedAidlcMemory(project);
  seedStateFile(project, "state-mid-ideation.md");
  const statePath = seededStateFile(project);
  writeFileSync(statePath, readFileSync(statePath, "utf-8").replace("- [-] feasibility", "- [?] feasibility"));
  appendAuditEntry("STAGE_STARTED", { Stage: SLUG, Agent: "aidlc-architect-agent", Session: "01995000-7a11-7000-8000-00000000beef" }, project);
  const graph: Record<string, unknown>[] = JSON.parse(readFileSync(join(AIDLC_SRC, "tools/data/stage-graph.json"), "utf-8"));
  const stages = graph.map((stage) => stage.slug !== SLUG ? stage : {
    ...stage, approval_mode: mode, summary_confirmation: options.summary ? "required" : "if-present",
    support_agents: [], sensors_applicable: [], produces: ["feasibility-assessment"], consumes: [], cites: [],
    ...(options.reviewer ? { reviewer: "aidlc-product-lead-agent", review_artifact: "feasibility-assessment", review_class: "adversarial" } : {}),
  });
  const graphPath = join(project, "stage-graph.json");
  writeFileSync(graphPath, JSON.stringify(stages));
  if (options.artifact !== false) {
    const dir = join(seededRecordDir(project), "ideation", SLUG);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "feasibility-assessment.md"), "# Feasibility\n\nThe interface can be built.\n");
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("AIDLC_") || key.startsWith("AWS_AIDLC_")) delete env[key];
  }
  Object.assign(env, {
    AIDLC_STAGE_GRAPH: graphPath,
    AIDLC_SCOPE_MAPPING: join(AIDLC_SRC, "tools/data/scope-grid.json"),
    AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS: "1",
    AIDLC_UNATTENDED: "1",
    AIDLC_SESSION_OVERRIDE: "01995000-7a11-7000-8000-00000000beef",
  });
  return { project, statePath, env };
}
type Fixture = ReturnType<typeof fixture>;
function run(f: Fixture, tool: "state" | "orchestrate", args: string[]) {
  const result = spawnSync(process.execPath, [
    join(REPO_ROOT, "core/tools", `aidlc-${tool}.ts`), ...args, "--project-dir", f.project,
  ], { cwd: f.project, env: f.env, encoding: "utf-8", timeout: 30_000 });
  return { status: result.status, output: (result.stdout ?? "") + (result.stderr ?? "") };
}
function unchanged(f: Fixture, args: string[], contains: string) {
  const before = readFileSync(f.statePath, "utf-8");
  const result = run(f, "state", args);
  expect(result.status, result.output).not.toBe(0);
  expect(result.output).toContain(contains);
  expect(readFileSync(f.statePath, "utf-8")).toBe(before);
}

describe("stage participation with lifecycle and presence guards enabled", () => {
  test("an autonomous non-Construction stage completes with no human witness", () => {
    const f = fixture("autonomous");
    const result = run(f, "state", ["approve", SLUG]);
    expect(result.status, result.output).toBe(0);
    expect(readFileSync(f.statePath, "utf-8")).toContain("- [x] feasibility");
    const approval = readAuditShardEvents(f.project).find((row) => row.event === "GATE_APPROVED");
    expect(approval).toBeDefined();
    expect(auditBlockField(approval!.block, "Person Reply")).toBeNull();
    expect(auditBlockField(approval!.block, "User Input")).toBeNull();
    expect(readAuditShardEvents(f.project).filter((row) => row.event === "HUMAN_TURN")).toHaveLength(0);
  });
  test("human mode still needs a real reply", () => {
    unchanged(fixture("human"), ["approve", SLUG, "--user-input", "Approve"], "reply");
  });
  test("an explicit person approval on an autonomous stage still needs a real reply", () => {
    unchanged(fixture("autonomous"), ["approve", SLUG, "--user-input", "Approve"], "reply");
  });
  test("autonomy cannot replace a declared summary receipt", () => {
    unchanged(fixture("autonomous", { summary: true }), ["approve", SLUG], "summary");
  });
  test("autonomy cannot replace a declared output", () => {
    unchanged(fixture("autonomous", { artifact: false }), ["approve", SLUG], "artifact");
  });
  test("autonomy cannot exercise the unfinished-review exception", () => {
    unchanged(fixture("autonomous", { reviewer: true }), ["approve", SLUG], "REVIEW");
  });
  test("an autonomous rejection is assistant-authored", () => {
    const f = fixture("autonomous");
    const result = run(f, "state", ["reject", SLUG, "--feedback", "The interface needs revision."]);
    expect(result.status, result.output).toBe(0);
    expect(readFileSync(f.statePath, "utf-8")).toContain("- [R] feasibility");
    const rejection = readAuditShardEvents(f.project).find((row) => row.event === "GATE_REJECTED");
    expect(auditBlockField(rejection!.block, "Person Reply")).toBeNull();
    expect(auditBlockField(rejection!.block, "Person Message")).toBeNull();
  });
  test("a reported person rejection still needs a real reply", () => {
    unchanged(fixture("autonomous"), ["reject", SLUG, "--user-input", "Request Changes", "--feedback", "Revise."], "reply");
  });
  test("report and state agree on unattended autonomous completion", () => {
    const f = fixture("autonomous");
    const result = run(f, "orchestrate", ["report", "--stage", SLUG, "--result", "approved"]);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('"kind":"done"');
    expect(readFileSync(f.statePath, "utf-8")).toContain("- [x] feasibility");
  });
  test("report cannot use autonomy to pass missing review evidence", () => {
    const f = fixture("autonomous", { reviewer: true });
    const before = readFileSync(f.statePath, "utf-8");
    const result = run(f, "orchestrate", ["report", "--stage", SLUG, "--result", "approved"]);
    expect(result.output).not.toContain('"kind":"done"');
    expect(readFileSync(f.statePath, "utf-8")).toBe(before);
  });
});
