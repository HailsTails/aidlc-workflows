import { workflowStageToGraph } from "../../core/tools/aidlc-workflow-wire.ts";
// covers: file:core/tools/aidlc-runner-gen.ts, file:core/tools/aidlc-runtime-paths.ts, file:core/tools/aidlc-init.ts
// covers: file:core/tools/aidlc-workflow-candidate.ts, file:core/tools/aidlc-workflow-candidate-inputs.ts
// Real filesystem and parser composition: isolated destinations, ownership-aware
// pruning, and link refusal cannot be established by a fake writer.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { walkFiles } from "../../core/tools/aidlc-distribution.ts";
import { loadGraph, renderComposedScopeRecord } from "../../core/tools/aidlc-graph.ts";
import { loadScopeMapping, loadScopeMetadata, loadStageGraphAll, pluginsEnabled, readScopeMetadata, scopeMappingFrom, selectScopeMetadata } from "../../core/tools/aidlc-lib.ts";
import { readRunnerScopeFronts, renderScopeRunner, regenerateRunnerSurfaces, runnerSurfaceRequest, type RunnerRenderContext, type RunnerSurfaceRequest } from "../../core/tools/aidlc-runner-gen.ts";
import { LinkedFolderError, resolveSkillsPath } from "../../core/tools/aidlc-runtime-paths.ts";
import { renderScopeTable, renderStageTable } from "../../core/tools/aidlc-utility.ts";
import { compileWorkflowCandidate, type WorkflowCandidate } from "../../core/tools/aidlc-workflow-candidate.ts";
import { readWorkflowCompilationRequest, type WorkflowCandidatePaths } from "../../core/tools/aidlc-workflow-candidate-inputs.ts";
import { createTestProject, REPO_ROOT, withEnvAndFreshCaches } from "../harness/fixtures.ts";
import { projectSnapshot, writeFixtureFile } from "../harness/install-adoption.ts";
import { testGuardEnvironment } from "../harness/runner-profile.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "../harness/test-budget.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "aidlc-surface-staging-")));
  roots.push(root);
  return root;
}

function put(root: string, relative: string, text: string): string {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

function snapshot(root: string): Record<string, string> {
  return Object.fromEntries(walkFiles(root).map((file) => [file.replaceAll("\\", "/"), readFileSync(join(root, file), "utf8")]));
}

interface SurfaceFixture {
  root: string;
  paths: WorkflowCandidatePaths;
  candidate: WorkflowCandidate;
  request: RunnerSurfaceRequest;
}

const SOURCE: RunnerRenderContext = {
  harnessDir: ".aidlc", distribution: "opencode", mode: "source", frontmatter: ["agent: source-fixture"],
};
const NATIVE: RunnerRenderContext = {
  harnessDir: ".codex", distribution: "codex", mode: "native", frontmatter: ["model: native-fixture"],
};
const COMPOSED_SCOPE = "pipeline-hardening-observability";

function fixture(render: RunnerRenderContext, selectedPlugins: string[] | null): SurfaceFixture {
  const root = tempRoot();
  const harness = join(root, render.harnessDir);
  for (const directory of ["aidlc-common/stages", "agents", "scopes", "sensors"]) {
    cpSync(join(REPO_ROOT, "core", directory), join(harness, directory), { recursive: true });
  }
  cpSync(join(REPO_ROOT, "plugins/test-pro/stages"), join(harness, "aidlc-common/stages"), { recursive: true });
  cpSync(join(REPO_ROOT, "plugins/test-pro/agents"), join(harness, "agents"), { recursive: true });
  cpSync(join(REPO_ROOT, "plugins/test-pro/scopes"), join(harness, "scopes"), { recursive: true });
  const paths: WorkflowCandidatePaths = {
    stagesDir: join(harness, "aidlc-common/stages"), stageGraphPath: join(harness, "tools/data/stage-graph.json"),
    scopeGridPath: join(harness, "tools/data/scope-grid.json"), scopesDir: join(harness, "scopes"),
    composedScopesDir: join(root, "aidlc/scopes"), rulesDir: join(root, "aidlc/spaces/default/memory"),
    sensorsDir: join(harness, "sensors"), agentsDir: join(harness, "agents"),
    harnessDataPath: join(harness, "tools/data/harness.json"), harnessDir: render.harnessDir,
  };
  put(harness, "tools/data/stage-graph.json", "[]\n");
  put(harness, "tools/data/harness.json", JSON.stringify({ name: render.distribution, harnessDir: render.harnessDir, plugins: selectedPlugins }));
  const composed = readFileSync(join(REPO_ROOT, "tests/fixtures/composed-scope-live/scope.md"), "utf8")
    .replace("skeleton: off", "skeleton: off\nrunner: true");
  const cells = JSON.parse(readFileSync(join(REPO_ROOT, "tests/fixtures/composed-scope-live/stages.json"), "utf8"));
  put(root, `aidlc/scopes/${COMPOSED_SCOPE}.md`, renderComposedScopeRecord(composed, cells, "surface fixture"));
  put(harness, `scopes/aidlc-${COMPOSED_SCOPE}.md`, composed);
  const candidate = compileWorkflowCandidate(readWorkflowCompilationRequest(paths));
  put(harness, "tools/data/stage-graph.json", candidate.json);
  put(harness, "tools/data/scope-grid.json", candidate.gridJson);
  const request = runnerSurfaceRequest({
    projectDir: root, scopesDir: paths.scopesDir,
    skillsDir: resolveSkillsPath([], { projectDir: root, harnessDir: render.harnessDir, distribution: render.distribution, mutable: true }),
    render, allStages: candidate.stages.map(workflowStageToGraph),
    allScopes: readRunnerScopeFronts(paths.scopesDir), allScopeOwners: readScopeMetadata(paths.scopesDir),
    gridScopeNames: Object.keys(candidate.grid), selectedPlugins,
  });
  return { root, paths, candidate, request };
}

function withConsoleFunctionsProtected<T>(run: () => T): T {
  const log = Object.getOwnPropertyDescriptor(console, "log")!;
  const error = Object.getOwnPropertyDescriptor(console, "error")!;
  // Keep the original functions callable, but reject transient global replacement.
  Object.defineProperty(console, "log", { ...log, writable: false });
  Object.defineProperty(console, "error", { ...error, writable: false });
  try { return run(); }
  finally {
    Object.defineProperty(console, "log", log);
    Object.defineProperty(console, "error", error);
  }
}

function generatedSurface(f: SurfaceFixture): Record<string, string> {
  regenerateRunnerSurfaces(f.request);
  const metadata = selectScopeMetadata(readScopeMetadata(f.paths.scopesDir), f.request.selectedPlugins === null ? null : new Set(f.request.selectedPlugins));
  return {
    ...snapshot(f.request.skillsDir),
    "stage-table": renderStageTable(f.request.stages),
    "scope-table": renderScopeTable(scopeMappingFrom(metadata, f.candidate.grid)),
  };
}

function interleavedSurfaces(a: SurfaceFixture, b: SurfaceFixture, ambient: SurfaceFixture) {
  return withEnvAndFreshCaches({
    AIDLC_PROJECT_DIR: ambient.root, AIDLC_RUNTIME_PROJECT_DIR: ambient.root,
    AIDLC_HARNESS_DIR: ambient.paths.harnessDir, AIDLC_HARNESS_DATA: ambient.paths.harnessDataPath,
    AIDLC_STAGE_GRAPH: ambient.paths.stageGraphPath, AIDLC_SCOPE_GRID: ambient.paths.scopeGridPath,
    AIDLC_SCOPES_DIR: ambient.paths.scopesDir, AIDLC_SCOPE_MAPPING: undefined,
  }, () => {
    const before = {
      env: { ...process.env }, graph: loadGraph(), allStages: loadStageGraphAll(),
      scopes: loadScopeMetadata(), mapping: loadScopeMapping(), plugins: pluginsEnabled(),
      log: console.log, error: console.error, files: snapshot(ambient.root),
    };
    const outputs = withConsoleFunctionsProtected(() => ({
      firstA: generatedSurface(a), b: generatedSurface(b), secondA: generatedSurface(a),
    }));
    return {
      ...outputs, before,
      after: {
        env: { ...process.env }, graph: loadGraph(), allStages: loadStageGraphAll(),
        scopes: loadScopeMetadata(), mapping: loadScopeMapping(), plugins: pluginsEnabled(),
        log: console.log, error: console.error, files: snapshot(ambient.root),
      },
    };
  });
}

function skill(f: SurfaceFixture, name: string): string {
  return join(f.request.skillsDir, name, "SKILL.md");
}

function legacySkill(f: SurfaceFixture, directory: string, command: string): string {
  return put(f.request.skillsDir, `${directory}/SKILL.md`, `---\nname: ${directory}\ndescription: Existing runner\n---\n\nbun .aidlc/tools/aidlc-orchestrate.ts next ${command}\n`);
}

function directoryLink(target: string, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");
}

function fileLinksAvailable(): boolean {
  const root = tempRoot();
  const target = put(root, "target.txt", "File-link capability probe.\n");
  try {
    symlinkSync(target, join(root, "linked.txt"), "file");
    return true;
  } catch (error) {
    if (process.platform === "win32" && error instanceof Error && "code" in error && error.code === "EPERM") return false;
    throw error;
  }
}

const canCreateFileLinks = fileLinksAvailable();

interface InstalledFixture {
  root: string;
  project: string;
  artifact: string;
  distribution: string;
  env: NodeJS.ProcessEnv;
}

function installedFixture(distribution: string, channel: "dist" | "dist-release"): InstalledFixture {
  const root = createTestProject();
  roots.push(root);
  const project = join(root, "project");
  const artifact = join(root, "artifact");
  const home = join(root, "home");
  const temp = join(root, "temp");
  mkdirSync(home, { recursive: true });
  mkdirSync(temp, { recursive: true });
  cpSync(join(REPO_ROOT, channel, distribution), artifact, { recursive: true });
  writeFixtureFile({ root: project, path: "aidlc/user-session-ledger.jsonl", text: "Untouched human decisions.\n" });
  const env = testGuardEnvironment({
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, SystemDrive: process.env.SystemDrive,
    ComSpec: process.env.ComSpec, PATHEXT: process.env.PATHEXT,
    HOME: home, USERPROFILE: home, AIDLC_HOME: join(home, ".aidlc"),
    AIDLC_INSTALL_ROOT: join(home, "installation"), AIDLC_BIN_DIR: join(home, "bin"),
    APPDATA: join(home, "AppData/Roaming"), LOCALAPPDATA: join(home, "AppData/Local"),
    TEMP: temp, TMP: temp, TMPDIR: temp, CODEX_HOME: join(home, ".codex"),
    CLAUDE_CONFIG_DIR: join(home, ".claude"), CI: "1", NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(home, "no-global-config"),
  }, "production");
  return { root, project, artifact, distribution, env };
}

function runInstalledConfig(f: InstalledFixture, runner: string, options: string[]) {
  const result = spawnSync(process.execPath, [
    runner, "config", "--from", f.artifact, "--harness", f.distribution,
    "--project-dir", f.project, "--json", ...options,
  ], {
    cwd: f.project, env: f.env, encoding: "utf8",
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  if (result.error) throw result.error;
  return result;
}

function runScopeCli(f: InstalledFixture, options: string[]) {
  const result = spawnSync(process.execPath, [
    join(f.artifact, ".aidlc/tools/aidlc-runner-gen.ts"), "scopes", ...options,
  ], {
    cwd: f.project, encoding: "utf8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    env: {
      ...f.env, AIDLC_RUNTIME_PROJECT_DIR: f.project, AIDLC_PROJECT_DIR: f.project,
      AIDLC_HARNESS_DIR: ".aidlc", AIDLC_SCOPES_DIR: join(f.artifact, ".aidlc/scopes"),
      AIDLC_HARNESS_DATA: join(f.artifact, ".aidlc/tools/data/harness.json"),
      AIDLC_SCOPE_GRID: join(f.artifact, ".aidlc/tools/data/scope-grid.json"),
    },
  });
  if (result.error) throw result.error;
  return result;
}

function recordProjectModels(f: InstalledFixture, runner: string) {
  const result = spawnSync(process.execPath, [
    runner, "config", "models", "--project-dir", f.project,
    "--project", "--reviewing-effort", "high", "--json", "--yes",
  ], {
    cwd: f.project, env: f.env, encoding: "utf8",
    timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  if (result.error) throw result.error;
  return result;
}

function changeCodexProjectScope(f: InstalledFixture): void {
  const scopePath = ".codex/scopes/aidlc-feature.md";
  const original = readFileSync(join(f.project, scopePath), "utf8");
  writeFixtureFile({ root: f.project, path: scopePath, text: original.replace(/^depth:.*$/m, "depth: Minimal") });
  writeFixtureFile({ root: f.project, path: ".codex/skills/team-playbook/SKILL.md", text: "# Custom Codex playbook\n\nPreserve this mixed-layout skill.\n" });
}

function changePrivateMemoryAndScope(f: InstalledFixture, skillsDirectory: string): void {
  writeFixtureFile({ root: f.project, path: "aidlc/spaces/default/memory/project.md", text: "# Project\n\nPrivate workflow surface refresh evidence.\n" });
  writeFixtureFile({ root: f.project, path: `${skillsDirectory}/team-playbook/SKILL.md`, text: "# Team playbook\n\nKeep this unmanaged skill byte for byte.\n" });
  const scopePath = ".aidlc/scopes/aidlc-feature.md";
  const original = readFileSync(join(f.artifact, scopePath), "utf8");
  writeFixtureFile({ root: f.artifact, path: scopePath, text: original
    .replace(/^depth:.*$/m, "depth: Minimal")
    .replace(/^description:.*$/m, "description: Refreshed workflow surface fixture") });
}

describe("explicit staged workflow surfaces", () => {
  test("A/B/A preserves captured source/native outputs and keeps primed ambient state untouched", () => {
    const a = fixture(NATIVE, ["test-pro"]);
    const b = fixture(SOURCE, ["aidlc"]);
    const ambient = fixture({ ...SOURCE, harnessDir: ".claude", distribution: "claude", frontmatter: ["model: ambient"] }, []);
    const result = interleavedSurfaces(a, b, ambient);
    expect(result.secondA).toEqual(result.firstA);
    expect(result.b).not.toEqual(result.firstA);
    expect(result.firstA["test-pro-integration/SKILL.md"]).toContain("aidlc engine orchestrate next --stage test-pro-integration --single");
    expect(result.firstA["test-pro-integration/SKILL.md"]).toContain("model: native-fixture\n");
    expect(result.firstA["aidlc-build-and-test/SKILL.md"]).toBeUndefined();
    expect(result.b["aidlc-build-and-test/SKILL.md"]).toContain("bun .aidlc/tools/aidlc-orchestrate.ts next --stage build-and-test --single");
    expect(result.b["aidlc-build-and-test/SKILL.md"]).toContain("agent: source-fixture\n");
    expect(result.b["test-pro-integration/SKILL.md"]).toBeUndefined();
    expect(result.firstA["stage-table"]).toContain("test-pro-integration");
    expect(result.firstA["stage-table"]).not.toContain("| build-and-test |");
    expect(result.b["scope-table"]).not.toContain("test-pro-validation");
    expect(result.after.env).toEqual(result.before.env);
    expect(result.after.graph).toBe(result.before.graph);
    expect(result.after.allStages).toBe(result.before.allStages);
    expect(result.after.scopes).toBe(result.before.scopes);
    expect(result.after.mapping).toBe(result.before.mapping);
    expect(result.after.plugins).toBe(result.before.plugins);
    expect(result.after.log).toBe(result.before.log);
    expect(result.after.error).toBe(result.before.error);
    expect(result.after.files).toEqual(result.before.files);
  });

  test.each([
    { distribution: "copilot", directory: ".github" },
    { distribution: "opencode", directory: ".aidlc" },
  ])("$distribution stages into its explicit skills destination despite sharing .aidlc", ({ distribution, directory }) => {
    const f = fixture({ ...SOURCE, distribution }, ["aidlc"]);
    regenerateRunnerSurfaces(f.request);
    expect(f.request.skillsDir).toBe(join(f.root, directory, "skills"));
    expect(readFileSync(join(f.root, directory, "skills/aidlc-build-and-test/SKILL.md"), "utf8"))
      .toContain("bun .aidlc/tools/aidlc-orchestrate.ts next --stage build-and-test --single");
  });

  test("disabled plugin runners are pruned by retained legacy ownership while unmanaged playbooks survive", () => {
    const f = fixture(SOURCE, ["aidlc"]);
    const disabledStage = legacySkill(f, "test-pro-integration", "--stage test-pro-integration --single");
    const disabledScope = legacySkill(f, "test-pro-validation", "--scope test-pro-validation");
    const staleInit = legacySkill(f, "aidlc-workspace-scaffold", "--stage workspace-scaffold --single");
    const custom = legacySkill(f, "team-playbook", "--stage test-pro-integration --single\n\nbun .aidlc/tools/aidlc-orchestrate.ts next --scope test-pro-validation");
    const beforeCustom = readFileSync(custom, "utf8");
    regenerateRunnerSurfaces(f.request);
    expect(existsSync(disabledStage)).toBe(false);
    expect(existsSync(disabledScope)).toBe(false);
    expect(existsSync(staleInit)).toBe(false);
    expect(readFileSync(custom, "utf8")).toBe(beforeCustom);
    expect(existsSync(skill(f, "aidlc-init"))).toBe(true);
    expect(existsSync(skill(f, "aidlc-compose"))).toBe(true);
  });

  test("the composed-grid exception still emits its scope runner when the core plugin is deselected", () => {
    const f = fixture(NATIVE, ["test-pro"]);
    regenerateRunnerSurfaces(f.request);
    expect(f.request.scopes[COMPOSED_SCOPE].name).toBe(COMPOSED_SCOPE);
    expect(readFileSync(skill(f, `aidlc-${COMPOSED_SCOPE}`), "utf8"))
      .toContain("aidlc engine orchestrate next --scope pipeline-hardening-observability");
    expect(existsSync(skill(f, "test-pro-validation"))).toBe(true);
    expect(existsSync(skill(f, "aidlc-test-pro-validation"))).toBe(false);
  });

  test.each([
    { name: "explicit empty selection", selectedPlugins: [], keepLegacyScope: false },
    { name: "empty discovery without selection", selectedPlugins: null, keepLegacyScope: true },
  ])("$name retains the established empty-batch pruning policy", ({ selectedPlugins, keepLegacyScope }) => {
    const f = fixture(SOURCE, ["aidlc"]);
    const legacy = legacySkill(f, "test-pro-validation", "--scope test-pro-validation");
    const request = runnerSurfaceRequest({ ...f.request, allScopes: {}, gridScopeNames: [], selectedPlugins });
    regenerateRunnerSurfaces(request);
    expect(existsSync(legacy)).toBe(keepLegacyScope);
  });

  test("a linked skills directory refuses generation without touching the link target", () => {
    const f = fixture(SOURCE, ["aidlc"]);
    const external = tempRoot();
    put(external, "sentinel.txt", "Do not change this target.\n");
    const before = snapshot(external);
    directoryLink(external, f.request.skillsDir);
    expect(() => regenerateRunnerSurfaces(f.request)).toThrow(LinkedFolderError);
    expect(snapshot(external)).toEqual(before);
  });

  test("a linked runner directory refuses generation without writing into its target", () => {
    const f = fixture(SOURCE, ["aidlc"]);
    const external = tempRoot();
    put(external, "SKILL.md", "A user-owned linked skill.\n");
    const before = snapshot(external);
    directoryLink(external, dirname(skill(f, "aidlc-build-and-test")));
    expect(() => regenerateRunnerSurfaces(f.request)).toThrow(LinkedFolderError);
    expect(snapshot(external)).toEqual(before);
  });

  test.skipIf(!canCreateFileLinks)("a linked SKILL.md refuses generation without overwriting its target", () => {
    const f = fixture(SOURCE, ["aidlc"]);
    const external = tempRoot();
    const target = put(external, "custom.md", "A user-owned linked skill file.\n");
    const before = snapshot(external);
    mkdirSync(dirname(skill(f, "aidlc-build-and-test")), { recursive: true });
    symlinkSync(target, skill(f, "aidlc-build-and-test"), "file");
    expect(() => regenerateRunnerSurfaces(f.request)).toThrow(LinkedFolderError);
    expect(snapshot(external)).toEqual(before);
  });
});

describe("installed config consumes explicit workflow surfaces", () => {
  test.each([
    { distribution: "copilot", channel: "dist" as const, directory: ".github/skills", otherDirectory: ".aidlc/skills", command: "bun .aidlc/tools/aidlc-orchestrate.ts" },
    { distribution: "opencode", channel: "dist" as const, directory: ".aidlc/skills", otherDirectory: ".github/skills", command: "bun .aidlc/tools/aidlc-orchestrate.ts" },
    { distribution: "copilot", channel: "dist-release" as const, directory: ".github/skills", otherDirectory: ".aidlc/skills", command: "aidlc engine orchestrate" },
    { distribution: "opencode", channel: "dist-release" as const, directory: ".aidlc/skills", otherDirectory: ".github/skills", command: "aidlc engine orchestrate" },
  ])("$distribution $channel refresh updates its main skill and scope runner without changing private state", ({ distribution, channel, directory, otherDirectory, command }) => {
    const f = installedFixture(distribution, channel);
    const installedRunner = join(f.project, ".aidlc/tools/aidlc.ts");
    const create = runInstalledConfig(f, join(f.artifact, ".aidlc/tools/aidlc.ts"), ["--yes"]);
    expect(create.status, `${create.stdout}\n${create.stderr}`).toBe(0);
    changePrivateMemoryAndScope(f, directory);
    const before = projectSnapshot(f.project);
    const plan = runInstalledConfig(f, installedRunner, ["--dry-run"]);
    expect(plan.status, `${plan.stdout}\n${plan.stderr}`).toBe(0);
    expect(projectSnapshot(f.project)).toEqual(before);
    const apply = runInstalledConfig(f, installedRunner, ["--yes"]);
    expect(apply.status, `${apply.stdout}\n${apply.stderr}`).toBe(0);
    expect(readFileSync(join(f.project, directory, "aidlc/SKILL.md"), "utf8"))
      .toContain("| feature        | Minimal       |");
    expect(readFileSync(join(f.project, directory, "aidlc-feature/SKILL.md"), "utf8"))
      .toContain("Refreshed workflow surface fixture. Packaging over `/aidlc --scope feature`");
    expect(readFileSync(join(f.project, directory, "aidlc-build-and-test/SKILL.md"), "utf8"))
      .toContain(`${command} next --stage build-and-test --single`);
    expect(readFileSync(join(f.project, "aidlc/user-session-ledger.jsonl"), "utf8"))
      .toBe("Untouched human decisions.\n");
    expect(readFileSync(join(f.project, "aidlc/spaces/default/memory/project.md"), "utf8"))
      .toBe("# Project\n\nPrivate workflow surface refresh evidence.\n");
    expect(readFileSync(join(f.project, directory, "team-playbook/SKILL.md"), "utf8"))
      .toBe("# Team playbook\n\nKeep this unmanaged skill byte for byte.\n");
    expect(existsSync(join(f.project, otherDirectory, "aidlc-feature/SKILL.md"))).toBe(false);
  });

  test("Codex project-projection refresh finds the shared main skill beside a custom-only harness skills directory", () => {
    const f = installedFixture("codex", "dist");
    const installedRunner = join(f.project, ".codex/tools/aidlc.ts");
    const create = runInstalledConfig(f, join(f.artifact, ".codex/tools/aidlc.ts"), ["--yes"]);
    expect(create.status, `${create.stdout}\n${create.stderr}`).toBe(0);
    const mainSkill = join(f.project, ".agents/skills/aidlc/SKILL.md");
    expect(readFileSync(mainSkill, "utf8")).toContain("| feature        | Standard      |");
    changeCodexProjectScope(f);
    expect(existsSync(join(f.project, ".codex/skills/aidlc/SKILL.md"))).toBe(false);
    const record = recordProjectModels(f, installedRunner);
    expect(record.status, `${record.stdout}\n${record.stderr}`).toBe(0);
    expect(readFileSync(mainSkill, "utf8")).toContain("| feature        | Minimal       |");
    expect(existsSync(join(f.project, ".codex/skills/aidlc/SKILL.md"))).toBe(false);
    expect(readFileSync(join(f.project, ".codex/skills/team-playbook/SKILL.md"), "utf8"))
      .toBe("# Custom Codex playbook\n\nPreserve this mixed-layout skill.\n");
    expect(readFileSync(join(f.project, "aidlc/user-session-ledger.jsonl"), "utf8"))
      .toBe("Untouched human decisions.\n");
  });
});

describe("scope CLI reads only the selected operation inputs", () => {
  test("an explicit output directory does not inspect the unrelated linked default destination", () => {
    const f = installedFixture("opencode", "dist");
    const external = tempRoot();
    put(external, "sentinel.txt", "Unrelated default destination.\n");
    const before = snapshot(external);
    const output = join(f.project, "safe-skills");
    directoryLink(external, join(f.project, ".aidlc/skills"));
    const result = runScopeCli(f, ["--out", output]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readFileSync(join(output, "aidlc-feature/SKILL.md"), "utf8"))
      .toContain("bun .aidlc/tools/aidlc-orchestrate.ts next --scope feature");
    expect(snapshot(external)).toEqual(before);
  });

  test("scope check does not validate unrelated full metadata needed only for pruning", () => {
    const f = installedFixture("opencode", "dist");
    const output = join(f.project, "safe-skills");
    const initial = runScopeCli(f, ["--out", output]);
    expect(initial.status, `${initial.stdout}\n${initial.stderr}`).toBe(0);
    writeFixtureFile({ root: f.artifact, path: ".aidlc/scopes/aidlc-metadata-probe.md", text:
      "---\nname: metadata-probe\ndescription: Unrelated non-runner metadata\nrunner: false\nskeleton: invalid\n---\n" });
    expect(() => readScopeMetadata(join(f.artifact, ".aidlc/scopes"))).toThrow("invalid skeleton value");
    const beforeProject = projectSnapshot(f.project);
    const beforeArtifact = projectSnapshot(f.artifact);
    const result = runScopeCli(f, ["--check", "--out", output]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("scope-runner(s) in sync");
    expect(projectSnapshot(f.project)).toEqual(beforeProject);
    expect(projectSnapshot(f.artifact)).toEqual(beforeArtifact);
  });
});


describe("runner scope frontmatter projection", () => {
  test.each([">", "|", ">-", "|-"])("%s descriptions retain the first nonempty indented line", (style) => {
    const root = tempRoot();
    put(root, "scope.md", `---\nname: folded\ndescription: ${style}\n\n  First description line\n  Later ignored line\nrunner: true\n---\n`);
    expect(readRunnerScopeFronts(root)).toEqual({ folded: { name: "folded", description: "First description line", runner: true } });
  });

  test("a top-level field ends an empty folded description", () => {
    const root = tempRoot();
    put(root, "scope.md", "---\nname: empty-fold\ndescription: >\n\nrunner: false\n  Not a description\n---\n");
    expect(readRunnerScopeFronts(root)).toEqual({ "empty-fold": { name: "empty-fold", description: "", runner: false } });
  });

  test("the shared scope-name policy permits uppercase and command-safe punctuation", () => {
    const root = tempRoot();
    put(root, "scope.md", "---\nname: Build_2026+v2@home\ndescription: Named work\n---\n");
    expect(readRunnerScopeFronts(root)).toEqual({ "Build_2026+v2@home": { name: "Build_2026+v2@home", description: "Named work" } });
  });

  test("scalar quoting and unknown runner values retain their existing meanings", () => {
    const root = tempRoot();
    put(root, "scope.md", "---\nname: 'quoted'\ndescription: \"Quoted description\"\nplugin: 'test-pro'\nrunner: yes\n---\n");
    expect(readRunnerScopeFronts(root)).toEqual({ quoted: { name: "quoted", description: "Quoted description", plugin: "test-pro" } });
  });

  test.each([
    { body: "# No frontmatter", error: "missing frontmatter" },
    { body: "---\ndescription: No name\n---\n", error: "missing required frontmatter: name" },
    { body: "---\nname: ../escape\n---\n", error: "has a name a scope cannot have" },
  ])("rejects invalid scope metadata: $error", ({ body, error }) => {
    const root = tempRoot();
    put(root, "scope.md", body);
    expect(() => readRunnerScopeFronts(root)).toThrow(error);
  });
});

describe("scope reconciliation captures ownership before mutation", () => {
  test("invalid full metadata fails a write before touching already generated runners", () => {
    const f = installedFixture("opencode", "dist");
    const output = join(f.project, "safe-skills");
    const initial = runScopeCli(f, ["--out", output]);
    expect(initial.status, `${initial.stdout}\n${initial.stderr}`).toBe(0);
    const scopes = join(f.artifact, ".aidlc/scopes");
    const feature = join(scopes, "aidlc-feature.md");
    writeFileSync(feature, readFileSync(feature, "utf8").replace(/^description:.*$/m, "description: Must not be written"));
    put(scopes, "aidlc-metadata-probe.md", "---\nname: metadata-probe\ndescription: Invalid ownership input\nrunner: false\nskeleton: invalid\n---\n");
    const before = snapshot(output);
    const result = runScopeCli(f, ["--out", output]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid skeleton value");
    expect(snapshot(output)).toEqual(before);
  });
});


describe("runtime scope capture isolation", () => {
  test("quiet regeneration does not emit a missing-scope capture warning", () => {
    const f = installedFixture("opencode", "dist");
    const source = join(f.artifact, ".aidlc/tools/aidlc-runner-gen.ts").replaceAll("\\", "/");
    const probe = put(f.root, "quiet-probe.ts", `process.env.AIDLC_SCOPES_DIR = ${JSON.stringify(join(f.root, "missing-scopes"))};\nconst { regenerateRunnerSurfaces } = await import(${JSON.stringify(source)});\nregenerateRunnerSurfaces();\n`);
    const result = spawnSync(process.execPath, [probe], {
      cwd: f.project, env: f.env, encoding: "utf8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  test("unselected empty discovery does not read malformed pruning-only metadata", () => {
    const f = installedFixture("opencode", "dist");
    const scopes = join(f.artifact, ".aidlc/scopes");
    for (const file of walkFiles(scopes)) {
      const path = join(scopes, file);
      writeFileSync(path, readFileSync(path, "utf8").replace(/^runner:.*$/m, "runner: false"));
    }
    put(scopes, "aidlc-metadata-probe.md", "---\nname: metadata-probe\nrunner: false\nskeleton: invalid\n---\n");
    const output = join(f.project, "safe-skills");
    put(output, "team-playbook/SKILL.md", "Retain the authored playbook.\n");
    const before = snapshot(output);
    const result = runScopeCli(f, ["--out", output]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stderr).toContain("No pruning performed");
    expect(snapshot(output)).toEqual(before);
  });
});


describe("empty reconciliation without an existing destination", () => {
  test("explicit empty selection needs no ownership read when there is nothing to remove", () => {
    const f = installedFixture("opencode", "dist");
    const harnessData = join(f.artifact, ".aidlc/tools/data/harness.json");
    writeFileSync(harnessData, JSON.stringify({ ...JSON.parse(readFileSync(harnessData, "utf8")), plugins: [] }));
    put(f.artifact, ".aidlc/tools/data/scope-grid.json", "{}\n");
    put(f.artifact, ".aidlc/scopes/aidlc-metadata-probe.md", "---\nname: metadata-probe\nrunner: false\nskeleton: invalid\n---\n");
    const output = join(f.project, "absent-skills");
    const result = runScopeCli(f, ["--out", output]);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("No enabled scope files with runner:true");
    expect(existsSync(output)).toBe(false);
  });
});


describe("scope identity reconciliation", () => {
  test.each([SOURCE, NATIVE])("retains whole valid identities and prunes only owned stale runners in $mode mode", (render) => {
    const { request } = fixture(render, ["aidlc", "test-pro"]);
    const names = ["feature", "feature.dot", "feature+api", "feature@home", "Build_2026", "2fast"];
    const allScopes = Object.fromEntries(names.map((name) => [name, { name, description: "Identity", runner: true }]));
    const captured = runnerSurfaceRequest({ ...request, allScopes });
    regenerateRunnerSurfaces(captured);
    for (const name of names) {
      expect(readFileSync(join(request.skillsDir, `aidlc-${name}/SKILL.md`), "utf8"))
        .toBe(renderScopeRunner({ scope: allScopes[name], render }));
    }
    // A prefix remaining selected must not protect a distinct stale identity.
    const stale = ["feature.dot", "feature+api", "feature@home", "Build_2026", "2fast"];
    for (const name of stale) {
      const body = renderScopeRunner({ scope: allScopes[name], render });
      put(request.skillsDir, `aidlc-${name}/SKILL.md`, body.replace("generated-by: aidlc-runner-gen\n", ""));
      put(request.skillsDir, `${name}/SKILL.md`, body.replace("generated-by: aidlc-runner-gen\n", ""));
      put(request.skillsDir, `marked-${name}/SKILL.md`, body);
    }
    const custom = renderScopeRunner({ scope: allScopes["feature.dot"], render }).replace("generated-by: aidlc-runner-gen\n", "");
    put(request.skillsDir, "team-playbook/SKILL.md", custom);
    put(request.skillsDir, "aidlc-feature-mismatch/SKILL.md", custom);
    const malformed = "---\ngenerated-by: aidlc-runner-gen\n---\naidlc engine orchestrate next --scope feature/other\n";
    put(request.skillsDir, "aidlc-malformed/SKILL.md", malformed);
    const lookalikes = [
      "notaidlc engine orchestrate", "bun .claude/tools/notaidlc-orchestrate.ts",
      "echo aidlc engine orchestrate", "bun other.ts aidlc-orchestrate.ts",
    ];
    for (const [index, executable] of lookalikes.entries()) {
      put(request.skillsDir, `aidlc-lookalike-${index}/SKILL.md`, `---\ngenerated-by: aidlc-runner-gen\n---\n${executable} next --scope Build_2026\n`);
    }
    const argumentOnly = "echo aidlc engine orchestrate next --scope Argument_Only\n";
    put(request.skillsDir, "aidlc-Argument_Only/SKILL.md", argumentOnly);
    const ambiguous = "---\ngenerated-by: aidlc-runner-gen\n---\naidlc engine orchestrate next --scope feature\naidlc engine orchestrate next --scope feature.dot\n";
    put(request.skillsDir, "aidlc-ambiguous/SKILL.md", ambiguous);
    regenerateRunnerSurfaces(runnerSurfaceRequest({
      ...captured, allScopes: { feature: allScopes.feature },
      allScopeOwners: Object.fromEntries(stale.map((name) => [name, { plugin: "test-pro" }])),
    }));
    expect(existsSync(join(request.skillsDir, "aidlc-feature/SKILL.md"))).toBe(true);
    for (const name of stale) {
      for (const dir of [`aidlc-${name}`, name, `marked-${name}`]) expect(existsSync(join(request.skillsDir, dir))).toBe(false);
    }
    expect(readFileSync(join(request.skillsDir, "team-playbook/SKILL.md"), "utf8")).toBe(custom);
    expect(readFileSync(join(request.skillsDir, "aidlc-feature-mismatch/SKILL.md"), "utf8")).toBe(custom);
    expect(readFileSync(join(request.skillsDir, "aidlc-malformed/SKILL.md"), "utf8")).toBe(malformed);
    expect(readFileSync(join(request.skillsDir, "aidlc-ambiguous/SKILL.md"), "utf8")).toBe(ambiguous);
    expect(readFileSync(join(request.skillsDir, "aidlc-Argument_Only/SKILL.md"), "utf8")).toBe(argumentOnly);
    for (const index of lookalikes.keys()) expect(existsSync(join(request.skillsDir, `aidlc-lookalike-${index}/SKILL.md`))).toBe(true);
  });
});
