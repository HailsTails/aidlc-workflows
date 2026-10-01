// covers: tool:aidlc-init, file:core/tools/aidlc-refresh-compatibility.ts
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function config(project: string, source: string, flags: string[] = []) {
  const result = spawnSync(process.execPath, [INIT, "config", "--project-dir", project, "--from", source, "--json", ...flags], {
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
    const restored = config(project, RELEASE, ["--refresh-open-workflows"]);
    expect(restored.status, restored.output).toBe(0);
    expect(readFileSync(join(project, tool), "utf-8")).toBe(original);
    expect(workspaceBytes(project)).toEqual(stateBefore);
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
  test("rolls back an interrupted payload update and leaves both workflow records untouched", () => {
    const fixture = contractFixture();
    const stateBefore = workspaceBytes(fixture.projectDir);
    const validation = planCompatibleRefresh(fixture);
    expect(() => executePlan(fixture.plan, { validateLocked: validation.validateLocked, failAfter: 1 })).toThrow("injected transaction failure");
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/one.ts"), "utf-8")).toBe("before one\n");
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/two.ts"), "utf-8")).toBe("before two\n");
    expect(workspaceBytes(fixture.projectDir)).toEqual(stateBefore);
  });

  test("refuses compatibility input changes made after planning", () => {
    const fixture = contractFixture();
    const validation = planCompatibleRefresh(fixture);
    put(fixture.projectDir, ".claude/tools/data/scope-grid.json", '{"new-scope":{}}');
    expect(() => executePlan(fixture.plan, { validateLocked: validation.validateLocked })).toThrow("inputs changed after planning");
    expect(readFileSync(join(fixture.projectDir, ".claude/tools/one.ts"), "utf-8")).toBe("before one\n");
  });

  test("refuses a state-schema change", () => {
    const fixture = contractFixture();
    planCompatibleRefresh(fixture);
    put(fixture.sourceRoot, ".claude/tools/aidlc-lib.ts", 'export const CURRENT_STATE_VERSION = "9";\n');
    expect(() => planCompatibleRefresh(fixture)).toThrow("state schemas must agree");
  });

  test("refuses a changed scope and any attempt to write workflow data", () => {
    const fixture = contractFixture();
    put(fixture.sourceRoot, ".claude/tools/data/scope-grid.json", '{"feature":{"stages":{"work":"SKIP"}}}');
    expect(() => planCompatibleRefresh(fixture)).toThrow('scope "feature" changes or disappears');
    fixture.plan.operations.push(writeOperation("././aidlc/spaces/default/intents/open/aidlc-state.md", "closed"));
    expect(() => planCompatibleRefresh(fixture)).toThrow("project workspace is read-only");
  });
});
