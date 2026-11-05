import { cpSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetGraphCache, renderComposedScopeRecord } from "../../core/tools/aidlc-graph.ts";
import type { WorkflowCandidatePaths } from "../../core/tools/aidlc-workflow-candidate-inputs.ts";
import { cleanupTestProject, REPO_ROOT } from "./fixtures.ts";
import { type InstallFixture, writeFixtureFile } from "./install-adoption.ts";
import { createPluginRefreshFixture } from "./install-plugin-refresh.ts";

export const COMPOSED_SCOPE_NAME = "pipeline-hardening-observability";
const fixtureRoots: string[] = [];
const restoreEnvironments: Array<() => void> = [];

export function cleanupWorkflowFixtures(): void {
  restoreEnvironments.splice(0).reverse().forEach((restoreEnvironment) => { restoreEnvironment(); });
  fixtureRoots.splice(0).forEach(cleanupTestProject);
}

export const candidateStageSource = (sensor: string, dependency = "observability-setup"): string => `---
slug: probe-check
plugin: probe
phase: operation
execution: ALWAYS
condition: Always
inputs: none
outputs: probe-report
lead_agent: aidlc-quality-agent
support_agents: []
mode: inline
produces: [probe-report]
consumes: []
requires_stage: [${dependency}]
scopes: [probe-scope]
sensors: [${sensor}]
---
# Probe check
`;

export function readFixtureText(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

/** Query an actual owned fixture path, including the root after cleanup. */
export function fixturePathStatus(request: { readonly root: string; readonly path?: string }): "present" | "absent" {
  return existsSync(join(request.root, request.path ?? "")) ? "present" : "absent";
}

/** Returns actual file bytes under the requested paths, independent of expected bytes. */
export function fixtureFileTexts(root: string, expectedFiles: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.keys(expectedFiles).map((path) => [path, readFixtureText(root, path)]));
}

export interface CandidateFixture {
  readonly root: string;
  readonly harnessRoot: string;
  readonly paths: WorkflowCandidatePaths;
  readonly codeGenerationPath: string;
}

export function createCandidateFixture(sensor: string, harnessDir = ".claude"): CandidateFixture {
  const root = mkdtempSync(join(tmpdir(), "aidlc-workflow-candidate-"));
  fixtureRoots.push(root);
  const harnessRoot = join(root, harnessDir);
  ["aidlc-common/stages", "agents", "scopes", "sensors"].forEach((directory) => {
    cpSync(join(REPO_ROOT, "core", directory), join(harnessRoot, directory), { recursive: true });
  });
  const paths: WorkflowCandidatePaths = {
    stagesDir: join(harnessRoot, "aidlc-common/stages"),
    stageGraphPath: join(harnessRoot, "tools/data/stage-graph.json"),
    scopeGridPath: join(harnessRoot, "tools/data/scope-grid.json"),
    scopesDir: join(harnessRoot, "scopes"), composedScopesDir: join(root, "aidlc/scopes"),
    rulesDir: join(root, "aidlc/spaces/default/memory"), sensorsDir: join(harnessRoot, "sensors"),
    agentsDir: join(harnessRoot, "agents"), harnessDataPath: join(harnessRoot, "tools/data/harness.json"), harnessDir,
  };
  writeFixtureFile({ root: harnessRoot, path: "tools/data/stage-graph.json",
    text: readFixtureText(REPO_ROOT, "dist/claude/.claude/tools/data/stage-graph.json") });
  writeFixtureFile({ root: harnessRoot, path: "aidlc-common/stages/operation/probe-check.md", text: candidateStageSource(sensor) });
  writeFixtureFile({ root: harnessRoot, path: "scopes/probe-scope.md", text: "---\nname: probe-scope\nplugin: probe\ndepth: standard\n---\n" });
  writeFixtureFile({ root: harnessRoot, path: `sensors/aidlc-${sensor}.md`,
    text: readFixtureText(REPO_ROOT, "core/sensors/aidlc-linter.md")
      .replace("id: linter", `id: ${sensor}`).replace("default_severity: advisory", "default_severity: blocking") });
  writeFixtureFile({ root: harnessRoot, path: "tools/data/harness.json", text: JSON.stringify({ name: "candidate", plugins: ["aidlc", "probe"] }) });
  writeFixtureFile({ root, path: "aidlc/spaces/default/memory/team.md", text: `# Private ${sensor} practice\n` });
  writeFixtureFile({ root, path: "aidlc/spaces/default/intents/open/audit.md", text: "Recorded human decision, unchanged.\r\n" });
  const identity = readFixtureText(REPO_ROOT, "tests/fixtures/composed-scope-live/scope.md");
  const stages = JSON.parse(readFixtureText(REPO_ROOT, "tests/fixtures/composed-scope-live/stages.json"));
  writeFixtureFile({ root, path: `aidlc/scopes/${COMPOSED_SCOPE_NAME}.md`, text: renderComposedScopeRecord(identity, stages, "live scope fixture") });
  writeFixtureFile({ root: harnessRoot, path: `scopes/aidlc-${COMPOSED_SCOPE_NAME}.md`, text: identity });
  return { root, harnessRoot, paths, codeGenerationPath: join(paths.stagesDir, "construction/code-generation.md") };
}

/** Owns temporary process bindings and guarantees restoration after failed assertions. */
export function bindCandidateRuntime(fixture: CandidateFixture) {
  const bindings = {
    AIDLC_STAGE_GRAPH: fixture.paths.stageGraphPath, AIDLC_AGENTS_DIR: fixture.paths.agentsDir,
    AIDLC_SCOPES_DIR: fixture.paths.scopesDir, AIDLC_STAGES_DIR: fixture.paths.stagesDir,
    AIDLC_RULES_DIR: fixture.paths.rulesDir, AIDLC_SENSORS_DIR: fixture.paths.sensorsDir,
    AIDLC_COMPOSED_SCOPES_DIR: fixture.paths.composedScopesDir, AIDLC_HARNESS_DIR: fixture.paths.harnessDir,
    AIDLC_RUNTIME_HARNESS_ROOT: fixture.harnessRoot,
  };
  const savedBindings = Object.fromEntries(Object.keys(bindings).map((key) => [key, process.env[key]]));
  restoreEnvironments.push(() => {
    Object.entries(savedBindings).forEach(([key, environmentValue]) => {
      if (environmentValue === undefined) delete process.env[key]; else process.env[key] = environmentValue;
    });
    __resetGraphCache();
  });
  Object.assign(process.env, bindings);
  __resetGraphCache();
  return bindings;
}

export function createWorkflowRefreshFixture(): InstallFixture {
  const fixture = createPluginRefreshFixture();
  fixtureRoots.push(fixture.root);
  return fixture;
}

export function writeWorkflowPrivateState(fixture: InstallFixture, status: "Completed" | "Running") {
  const identity = readFixtureText(REPO_ROOT, "tests/fixtures/composed-scope-live/scope.md");
  const stages = JSON.parse(readFixtureText(REPO_ROOT, "tests/fixtures/composed-scope-live/stages.json"));
  const privateFiles = {
    "aidlc/spaces/default/memory/team.md": "# Private team practice\r\nPreserve this unchanged.\r\n",
    "aidlc/spaces/default/memory/project.md": "# Private project practice\nKeep the person's choice.\n",
    [`aidlc/scopes/${COMPOSED_SCOPE_NAME}.md`]: renderComposedScopeRecord(identity, stages, "live composer fixture"),
    "aidlc/spaces/default/intents/open/audit.md": "Recorded approval remains unchanged.\r\n",
    "aidlc/spaces/default/intents/open/aidlc-state.md": `# AI-DLC State Tracking\n- **State Version**: 8\n- **Scope**: feature\n- **Status**: ${status}\n- **Current Stage**: requirements-analysis\n`,
    "aidlc/spaces/default/intents/open/questions.md": "[Answer]: Approve Plan\r\nExact human words.\r\n",
  };
  Object.entries(privateFiles).forEach(([path, text]) => { writeFixtureFile({ root: fixture.project, path, text }); });
  return { identity, stages, privateFiles };
}
