// covers: tool:aidlc-init, file:core/tools/aidlc-refresh-compatibility.ts
import { afterAll, describe, expect, test } from "bun:test";
import "../../core/tools/aidlc-refresh-compatibility.test.ts";
import { ok as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256File, walkFiles } from "../../core/tools/aidlc-distribution.ts";
import { planCompatibleRefresh } from "../../core/tools/aidlc-refresh-compatibility.ts";
import { executePlan, type TransactionPlan, writeOperation } from "../../core/tools/aidlc-transaction.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const INIT = join(ROOT, "core/tools/aidlc-init.ts");
const RELEASE = join(ROOT, "dist-release/claude");
const temporary: string[] = [];
const temp = (): string => {
  const path = mkdtempSync(join(tmpdir(), "aidlc-open-refresh-"));
  temporary.push(path);
  return path;
};
afterAll(() => {
  for (const path of temporary) rmSync(path, { recursive: true, force: true });
}, 60_000);

function put(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function workspaceBytes(project: string): Record<string, string> {
  const root = join(project, "aidlc");
  return Object.fromEntries(walkFiles(root).map((path) => [path, sha256File(join(root, path))]));
}

function workflows(project: string): void {
  for (const [space, parked] of [["default", false], ["other", true]] as const) {
    const root = `aidlc/spaces/${space}/intents`;
    put(project, `${root}/intents.json`, JSON.stringify([{
      uuid: `00000000-0000-4000-8000-00000000000${parked ? "2" : "1"}`,
      slug: "open", dirName: "open", scope: "feature", status: "in-flight",
    }]));
    put(project, `${root}/open/aidlc-state.md`,
      `# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n${parked ? "- **Parked**: independent work\n" : ""}`);
    put(project, `${root}/open/audit.md`, "Existing audit evidence.\n");
    put(project, `${root}/active-intent`, "open\n");
  }
  put(project, "aidlc/active-space", "default\n");
}

const engineQuestionsNote = 'Open-workflow refresh accepts the engine-written questions declaration for stage "code-generation" (plan-approval-questions): Plan Approval rechecks a retained code-generation-questions.md before its answer counts.';

function sourceBeforeEngineQuestions(): string {
  const older = temp();
  cpSync(RELEASE, older, { recursive: true });
  const engineClause = "; the engine writes code-generation-questions.md)";
  for (const path of [".claude/aidlc-common/stages/construction/code-generation.md", ".claude/tools/data/stage-graph.json"]) {
    const shipped = readFileSync(join(older, path), "utf-8");
    expect(shipped).toContain(engineClause);
    put(older, path, shipped.replace(engineClause, ")"));
  }
  return older;
}

function openProjectFrom(source: string): string {
  const project = temp();
  mkdirSync(join(project, ".git"));
  const installed = config(project, source);
  expect(installed.status, installed.output).toBe(0);
  workflows(project);
  return project;
}

function config(project: string, source: string, flags: string[] = []) {
  return configText(project, source, ["--json", ...flags]);
}

function configText(project: string, source: string, flags: string[]) {
  const result = spawnSync(process.execPath, [INIT, "config", "--project-dir", project, "--from", source, ...flags], {
    cwd: project, encoding: "utf-8", timeout: 60_000,
    env: { ...process.env, AIDLC_PROJECT_DIR: project, CLAUDE_PROJECT_DIR: project, AIDLC_HARNESS_DIR: ".claude", AIDLC_HARNESS_NAME: "claude" },
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr, stdout: result.stdout };
}

describe("compatible refresh with independent workflows", () => {
  test("adopts an exact pre-manifest source before regenerating its skill, while refusing an edited lookalike", () => {
    const source = temp();
    cpSync(RELEASE, source, { recursive: true });
    const descriptor = ".claude/tools/data/aidlc-projection.json";
    const projection = JSON.parse(readFileSync(join(source, descriptor), "utf-8"));
    delete projection.legacyManagedFileHashes;
    put(source, descriptor, JSON.stringify(projection));
    for (const edited of [false, true]) {
      const project = temp();
      cpSync(source, project, { recursive: true });
      mkdirSync(join(project, ".git"));
      const harness = ".claude/tools/data/harness.json";
      const settings = JSON.parse(readFileSync(join(project, harness), "utf-8"));
      settings.plugins = [];
      put(project, harness, JSON.stringify(settings));
      const skill = ".claude/skills/aidlc/SKILL.md";
      if (edited) put(project, skill, `${readFileSync(join(project, skill), "utf-8")}\nPrivate instruction.\n`);
      const result = config(project, source);
      expect(result.status, result.output).toBe(edited ? 4 : 0);
      if (edited) expect(readFileSync(join(project, skill), "utf-8")).toContain("Private instruction.");
    }
  }, 60_000);

  test("plans, updates and restores an installed payload without changing open or parked state", () => {
    const project = temp();
    mkdirSync(join(project, ".git"));
    const installed = config(project, RELEASE);
    expect(installed.status, installed.output).toBe(0);
    workflows(project);
    rmSync(join(project, "aidlc/active-space"));
    put(project, ".claude/tools/consumer-only.ts", "// consumer-owned\n");
    put(project, ".claude/settings.local.json", '{"permissions":{"deny":["Bash(private-command)"]}}\n');
    const stateBefore = workspaceBytes(project);
    const settingsBefore = readFileSync(join(project, ".claude/settings.json"));
    const localBefore = readFileSync(join(project, ".claude/settings.local.json"));
    const newer = temp();
    cpSync(RELEASE, newer, { recursive: true });
    const tool = ".claude/tools/aidlc-command.ts";
    const original = readFileSync(join(newer, tool), "utf-8");
    put(newer, tool, `${original}\n// compatible payload update\n`);
    const dryRun = config(project, newer, ["--refresh-open-workflows", "--dry-run"]);
    expect(dryRun.status, dryRun.output).toBe(0);
    const plan = JSON.parse(dryRun.stdout);
    expect(plan.data.refreshCompatibility.stateVersion).toBe("8");
    expect(plan.data.refreshCompatibility.stages).toBeGreaterThan(0);
    expect(workspaceBytes(project)).toEqual(stateBefore);
    const applied = config(project, newer, ["--refresh-open-workflows", "--plan-token", plan.data.planToken]);
    expect(applied.status, applied.output).toBe(0);
    expect(readFileSync(join(project, tool), "utf-8")).toContain("compatible payload update");
    expect(workspaceBytes(project)).toEqual(stateBefore);
    expect(readFileSync(join(project, ".claude/settings.json"))).toEqual(settingsBefore);
    expect(readFileSync(join(project, ".claude/settings.local.json"))).toEqual(localBefore);
    expect(readFileSync(join(project, ".claude/tools/consumer-only.ts"), "utf-8")).toBe("// consumer-owned\n");
    expect(JSON.parse(readFileSync(join(project, ".claude/tools/data/aidlc-manifest.json"), "utf-8")).files[".claude/tools/consumer-only.ts"]).toBeUndefined();
    const restored = config(project, RELEASE, ["--refresh-open-workflows"]);
    expect(restored.status, restored.output).toBe(0);
    expect(readFileSync(join(project, tool), "utf-8")).toBe(original);
    expect(workspaceBytes(project)).toEqual(stateBefore);
    expect(readFileSync(join(project, ".claude/tools/consumer-only.ts"), "utf-8")).toBe("// consumer-owned\n");
  }, 60_000);

  test("refuses a changed approval contract and a force combination without changing the project", () => {
    const project = temp();
    mkdirSync(join(project, ".git"));
    expect(config(project, RELEASE).status).toBe(0);
    workflows(project);
    const before = workspaceBytes(project);
    const tool = ".claude/tools/aidlc-command.ts";
    const toolBefore = readFileSync(join(project, tool));
    const newer = temp();
    cpSync(RELEASE, newer, { recursive: true });
    const stage = ".claude/aidlc-common/stages/construction/code-generation.md";
    put(newer, stage, readFileSync(join(newer, stage), "utf-8").replace(/^---\r?\n/, "---\napproval_mode: autonomous\n"));
    const refused = config(project, newer, ["--refresh-open-workflows"]);
    expect(refused.status).toBe(4);
    expect(JSON.parse(refused.stdout).message).toContain('stage "code-generation" changes or disappears');
    const forced = config(project, newer, ["--refresh-open-workflows", "--force"]);
    expect(forced.status).not.toBe(0);
    expect(forced.output).toContain("cannot be combined");
    expect(workspaceBytes(project)).toEqual(before);
    expect(readFileSync(join(project, tool))).toEqual(toolBefore);
  }, 60_000);

  test("names an accepted revalidation in a note on the dry run, and the apply accepts the dry run's token", () => {
    const project = openProjectFrom(sourceBeforeEngineQuestions());
    const before = workspaceBytes(project);
    const dryRun = config(project, RELEASE, ["--refresh-open-workflows", "--dry-run"]);
    expect(dryRun.status, dryRun.output).toBe(0);
    const plan = JSON.parse(dryRun.stdout);
    expect(plan.data.refreshCompatibility.stageRevalidation).toEqual({ "code-generation": ["plan-approval-questions"] });
    expect(plan.data.notes).toContain(engineQuestionsNote);
    expect(configText(project, RELEASE, ["--refresh-open-workflows", "--dry-run"]).stdout).toContain(`Note: ${engineQuestionsNote}`);
    expect(configText(project, RELEASE, ["--refresh-open-workflows", "--dry-run", "--quiet"]).output).toContain(`Warning: ${engineQuestionsNote}`);
    const applied = config(project, RELEASE, ["--refresh-open-workflows", "--plan-token", plan.data.planToken]);
    expect(applied.status, applied.output).toBe(0);
    expect(JSON.parse(applied.stdout).data.notes).toContain(engineQuestionsNote);
    expect(JSON.parse(applied.stdout).data.planToken).toBe(plan.data.planToken);
    expect(workspaceBytes(project)).toEqual(before);
  }, 120_000);

  test("names the open workflow at the accepted stage without changing the plan token", () => {
    const project = openProjectFrom(sourceBeforeEngineQuestions());
    const elsewhere = config(project, RELEASE, ["--refresh-open-workflows", "--dry-run"]);
    expect(elsewhere.status, elsewhere.output).toBe(0);
    const state = join(project, "aidlc/spaces/default/intents/open/aidlc-state.md");
    put(project, "aidlc/spaces/default/intents/open/aidlc-state.md",
      readFileSync(state, "utf-8").replace("- **Current Stage**: requirements-analysis", "- **Current Stage**: code-generation"));
    const atStage = config(project, RELEASE, ["--refresh-open-workflows", "--dry-run"]);
    expect(atStage.status, atStage.output).toBe(0);
    expect({
      elsewhere: JSON.parse(elsewhere.stdout).data.notes.includes(engineQuestionsNote),
      atStage: JSON.parse(atStage.stdout).data.notes.includes(`${engineQuestionsNote} Open at this stage: default/open.`),
      sameToken: JSON.parse(atStage.stdout).data.planToken === JSON.parse(elsewhere.stdout).data.planToken,
    }).toEqual({ elsewhere: true, atStage: true, sameToken: true });
  }, 120_000);

  test.each([
    { mode: "human", flags: [], line: `Note: ${engineQuestionsNote}`, stream: "stdout" },
    { mode: "quiet", flags: ["--quiet"], line: `Warning: ${engineQuestionsNote}`, stream: "output" },
  ] as const)("names an accepted revalidation on a $mode apply", ({ flags, line, stream }) => {
    const project = openProjectFrom(sourceBeforeEngineQuestions());
    const before = workspaceBytes(project);
    const applied = configText(project, RELEASE, ["--refresh-open-workflows", ...flags]);
    expect(applied.status, applied.output).toBe(0);
    expect(applied[stream]).toContain(line);
    expect(workspaceBytes(project)).toEqual(before);
  }, 120_000);

  test("retains ownership refusal for a locally edited installed tool", () => {
    const project = temp();
    mkdirSync(join(project, ".git"));
    expect(config(project, RELEASE).status).toBe(0);
    workflows(project);
    const before = workspaceBytes(project);
    const tool = ".claude/tools/aidlc-command.ts";
    const edited = `${readFileSync(join(project, tool), "utf-8")}\n// local edit\n`;
    put(project, tool, edited);
    const refused = config(project, RELEASE, ["--refresh-open-workflows"]);
    expect(refused.status).toBe(4);
    expect(refused.output).toContain("locally modified or unowned");
    expect(readFileSync(join(project, tool), "utf-8")).toBe(edited);
    expect(workspaceBytes(project)).toEqual(before);
  }, 60_000);
});

function contractFixture() {
  const projectDir = temp();
  const sourceRoot = temp();
  for (const root of [projectDir, sourceRoot]) {
    put(root, ".claude/tools/aidlc-lib.ts", 'export const CURRENT_STATE_VERSION = "8";\n');
    put(root, ".claude/tools/data/stage-graph.json", '[{"slug":"work","mode":"inline"}]');
    put(root, ".claude/tools/data/scope-grid.json", '{"feature":{"stages":{"work":"EXECUTE"}}}');
  }
  workflows(projectDir);
  put(projectDir, ".claude/tools/one.ts", "before one\n");
  put(projectDir, ".claude/tools/two.ts", "before two\n");
  const plan: TransactionPlan = {
    schemaVersion: 1, root: projectDir, operations: [
      writeOperation(".claude/tools/one.ts", "after one\n", sha256File(join(projectDir, ".claude/tools/one.ts"))),
      writeOperation(".claude/tools/two.ts", "after two\n", sha256File(join(projectDir, ".claude/tools/two.ts"))),
    ],
  };
  return { projectDir, sourceRoot, harnessDir: ".claude", plan };
}

describe("refresh compatibility at the existing transaction boundary", () => {
  test("a schema mismatch is an explicit refusal result", () => {
    const fixture = contractFixture();
    put(fixture.sourceRoot, ".claude/tools/aidlc-lib.ts", 'export const CURRENT_STATE_VERSION = "9";');
    expect(planCompatibleRefresh(fixture)).toMatchObject({
      kind: "refused", reason: "state-schema-changed",
    });
  });

  test("updates and restores advisory write sensors without writing either workflow record", () => {
    const fixture = contractFixture();
    const graph = ".claude/tools/data/stage-graph.json";
    const original = '[{"slug":"work","mode":"inline"}]';
    const newer = '[{"slug":"work","mode":"inline","sensors":["advisory-write"],"sensors_applicable":[{"id":"advisory-write","path":".claude/sensors/advisory.md","fire_on":"write","default_severity":"advisory"}]}]';
    put(fixture.sourceRoot, graph, newer);
    const update: TransactionPlan = { ...fixture.plan, operations: [
      writeOperation(graph, newer, sha256File(join(fixture.projectDir, graph))),
    ] };
    const validation = planCompatibleRefresh({ ...fixture, plan: update });
    assert(validation.kind === "planned");
    executePlan(update, { validateLocked: validation.validateLocked });
    expect(readFileSync(join(fixture.projectDir, graph), "utf-8")).toBe(newer);
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/default/intents/open/aidlc-state.md"), "utf-8")).toBe(
      "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n");
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/other/intents/open/aidlc-state.md"), "utf-8")).toBe(
      "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n- **Parked**: independent work\n");
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/default/intents/open/audit.md"), "utf-8")).toBe("Existing audit evidence.\n");
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/other/intents/open/audit.md"), "utf-8")).toBe("Existing audit evidence.\n");
    put(fixture.sourceRoot, graph, original);
    const restore: TransactionPlan = { ...fixture.plan, operations: [
      writeOperation(graph, original, sha256File(join(fixture.projectDir, graph))),
    ] };
    const rollback = planCompatibleRefresh({ ...fixture, plan: restore });
    assert(rollback.kind === "planned");
    executePlan(restore, { validateLocked: rollback.validateLocked });
    expect(readFileSync(join(fixture.projectDir, graph), "utf-8")).toBe(original);
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/default/intents/open/aidlc-state.md"), "utf-8")).toBe(
      "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n");
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/other/intents/open/aidlc-state.md"), "utf-8")).toBe(
      "# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: Running\n- **Current Stage**: requirements-analysis\n- **Parked**: independent work\n");
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/default/intents/open/audit.md"), "utf-8")).toBe("Existing audit evidence.\n");
    expect(readFileSync(join(fixture.projectDir, "aidlc/spaces/other/intents/open/audit.md"), "utf-8")).toBe("Existing audit evidence.\n");
  });

  test.each([
    { sensors: ["new-sensor"], sensors_applicable: [{ id: "new-sensor", path: ".claude/sensors/new.md", fire_on: "gate", default_severity: "advisory" }] },
    { sensors: ["new-sensor"], sensors_applicable: [{ id: "new-sensor", path: ".claude/sensors/new.md", fire_on: "write", default_severity: "blocking" }] },
    { sensors: [], sensors_applicable: [{ id: "new-sensor", path: ".claude/sensors/new.md", fire_on: "write", default_severity: "advisory" }] },
    { sensors: ["new-sensor", "new-sensor"], sensors_applicable: [
      { id: "new-sensor", path: ".claude/sensors/new.md", fire_on: "write", default_severity: "advisory" },
      { id: "new-sensor", path: ".claude/sensors/new.md", fire_on: "write", default_severity: "advisory" },
    ] },
    { sensors: ["new-sensor"], sensors_applicable: [{ id: "new-sensor", path: ".claude/sensors/new.md", fire_on: "write", default_severity: "advisory", enforcement: "blocking" }] },
    { sensors: null, sensors_applicable: null },
    { sensors: ["new-sensor"], sensors_applicable: [{ id: "new-sensor", path: "", fire_on: "write", default_severity: "advisory" }] },
  ])("refuses added gate/blocking sensors or malformed advisory registration %#", (change) => {
    const fixture = contractFixture();
    put(fixture.sourceRoot, ".claude/tools/data/stage-graph.json",
      JSON.stringify([{ slug: "work", mode: "inline", ...change }]));
    expect(planCompatibleRefresh(fixture)).toMatchObject({ kind: "refused", reason: "stage-contract-changed" });
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/one.ts"), "utf-8")).toBe("before one\n");
  });

  test.each([
    { sensors: [], sensors_applicable: [] },
    { sensors_applicable: [{ id: "required", path: ".claude/sensors/required.md", fire_on: "write", default_severity: "advisory" }] },
    { sensors_applicable: [{ id: "required", path: ".claude/sensors/other.md", fire_on: "gate", default_severity: "blocking" }] },
    { approval_mode: "autonomous" },
    { produces: [] },
  ])("retains gate sensor metadata and approval/artifact contract %#", (change) => {
    const fixture = contractFixture();
    const graph = ".claude/tools/data/stage-graph.json";
    const stage = { slug: "work", mode: "inline", approval_mode: "explicit",
      produces: ["facts"], sensors: ["required"], sensors_applicable: [
        { id: "required", path: ".claude/sensors/required.md", fire_on: "gate", default_severity: "blocking" },
      ] };
    put(fixture.projectDir, graph, JSON.stringify([stage]));
    put(fixture.sourceRoot, graph, JSON.stringify([{ ...stage, ...change }]));
    expect(planCompatibleRefresh(fixture)).toMatchObject({ kind: "refused", reason: "stage-contract-changed" });
  });

  test("rolls back an interrupted payload update and leaves both workflow records untouched", () => {
    const fixture = contractFixture();
    const stateBefore = workspaceBytes(fixture.projectDir);
    const validation = planCompatibleRefresh(fixture);
    assert(validation.kind === "planned");
    expect(() => executePlan(fixture.plan, { validateLocked: validation.validateLocked, failAfter: 1 })).toThrow("injected transaction failure");
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/one.ts"), "utf-8")).toBe("before one\n");
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/two.ts"), "utf-8")).toBe("before two\n");
    expect(workspaceBytes(fixture.projectDir)).toEqual(stateBefore);
  });

  test("refuses compatibility input changes made after planning", () => {
    const fixture = contractFixture();
    const validation = planCompatibleRefresh(fixture);
    assert(validation.kind === "planned");
    put(fixture.projectDir, ".claude/tools/data/scope-grid.json", '{"new-scope":{}}');
    expect(executePlan(fixture.plan, { validateLocked: validation.validateLocked })).toMatchObject({
      kind: "refused", message: "open-workflow refresh compatibility inputs changed after planning; plan again",
    });
    expect(existsSync(join(fixture.projectDir, ".aidlc-transaction.lock"))).toBe(false);
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/two.ts"), "utf-8")).toBe("before two\n");
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/one.ts"), "utf-8")).toBe("before one\n");
  });

  test("refuses a state-schema change", () => {
    const fixture = contractFixture();
    planCompatibleRefresh(fixture);
    put(fixture.sourceRoot, ".claude/tools/aidlc-lib.ts", 'export const CURRENT_STATE_VERSION = "9";\n');
    expect(planCompatibleRefresh(fixture)).toMatchObject({ kind: "refused", reason: "state-schema-changed" });
  });

  test("refuses a changed scope and any attempt to write workflow data", () => {
    const fixture = contractFixture();
    put(fixture.sourceRoot, ".claude/tools/data/scope-grid.json", '{"feature":{"stages":{"work":"SKIP"}}}');
    expect(planCompatibleRefresh(fixture)).toMatchObject({ kind: "refused", reason: "scope-contract-changed" });
    fixture.plan.operations.push(writeOperation("././aidlc/spaces/default/intents/open/aidlc-state.md", "closed"));
    expect(planCompatibleRefresh(fixture)).toMatchObject({ kind: "refused", reason: "workspace-write" });
  });
});
