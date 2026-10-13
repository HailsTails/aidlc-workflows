import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseToml, TomlDate } from "smol-toml";
import { runPluginCompose, type PluginComposeRunResult } from "../../dist/claude/.claude/tools/aidlc-plugin-test.ts";
import { projectedPluginHookContributionsSchema } from "../../core/tools/aidlc-plugin-hook-registrations.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { NATIVE_PROCESS_CLEANUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import { hermeticGitEnvironment } from "../../plugins/rin/tools/hermetic-git/hermetic-git-environment.ts";

type Face = { harness: "claude" | "codex"; leaf: string; nativeFile: string; navigationNeedle: string; skillFile: string };
type Fixture = Face & { projectDir: string; pluginRoot: string; environment: NodeJS.ProcessEnv; initialization: SpawnSyncReturns<string>; composition: PluginComposeRunResult };

const faces: Face[] = [
  { harness: "claude", leaf: ".claude", nativeFile: ".claude/settings.json", navigationNeedle: "guard-navigation.mjs", skillFile: ".claude/skills/aidlc/SKILL.md" },
  { harness: "codex", leaf: ".codex", nativeFile: ".codex/hooks.json", navigationNeedle: "rin-guard-navigation", skillFile: ".agents/skills/aidlc/SKILL.md" },
];
const scratch = mkdtempSync(join(tmpdir(), "aidlc-t345-"));
const navigationTrustHash = `sha256:${createHash("sha256").update('{"event_name":"pre_tool_use","hooks":[{"async":false,"command":"bun .codex/tools/aidlc.ts engine adapter codex rin-guard-navigation","timeout":600,"type":"command"}],"matcher":"Bash"}').digest("hex")}`;

afterAll(() => rmSync(scratch, { recursive: true, force: true }), NATIVE_PROCESS_CLEANUP_TIMEOUT_MS);

function initializeSelected({ face, label, pluginRoot = join(REPO_ROOT, "dist/plugins/rin", face.harness) }: { face: Face; label: string; pluginRoot?: string }): Fixture {
  const projectDir = join(scratch, label);
  mkdirSync(join(projectDir, ".git"), { recursive: true });
  const configHome = join(scratch, `${label}-home`);
  mkdirSync(configHome, { recursive: true });
  const environment: NodeJS.ProcessEnv = { ...hermeticGitEnvironment({ configHome }), CODEX_HOME: join(configHome, ".codex"), CLAUDE_CONFIG_DIR: join(configHome, ".claude"), AIDLC_PROJECT_DIR: projectDir, CLAUDE_PROJECT_DIR: projectDir, AIDLC_RUNTIME_PROJECT_DIR: projectDir, AIDLC_RUNTIME_HARNESS_ROOT: join(projectDir, face.leaf), AIDLC_STAGE_GRAPH: join(projectDir, face.leaf, "tools/data/stage-graph.json"), AIDLC_SCOPE_GRID: join(projectDir, face.leaf, "tools/data/scope-grid.json"), AIDLC_SCOPES_DIR: join(projectDir, face.leaf, "scopes"), AIDLC_SENSORS_DIR: join(projectDir, face.leaf, "sensors"), AIDLC_AGENTS_DIR: join(projectDir, face.leaf, "agents"), AIDLC_RULES_DIR: join(projectDir, "aidlc/spaces/default/memory"), AIDLC_HARNESS_DIR: face.leaf, AIDLC_HARNESS_NAME: face.harness, CLAUDE_PLUGIN_ROOT: pluginRoot, PLUGIN_ROOT: pluginRoot, AIDLC_PLUGIN_ROOT: pluginRoot };
  const initialization = configProject({ ...face, projectDir, environment });
  const metadata = join(projectDir, face.leaf, "tools/data/harness.json");
  writeFileSync(metadata, `${JSON.stringify({ ...JSON.parse(readFileSync(metadata, "utf8")), plugins: ["aidlc", "rin"] }, null, 2)}\n`);
  const composition = runPluginCompose({ harness: face.harness, harnessLeaf: face.leaf, projectDir, pluginBuilt: pluginRoot, env: environment });
  return { ...face, projectDir, pluginRoot, environment, initialization, composition };
}

function configProject(fixture: Face & { projectDir: string; environment: NodeJS.ProcessEnv }) {
  return spawnSync(process.execPath, [join(REPO_ROOT, "core/tools/aidlc-init.ts"), "config", "--from", join(REPO_ROOT, "dist", fixture.harness), "--project-dir", fixture.projectDir], { cwd: fixture.projectDir, env: fixture.environment, encoding: "utf8", timeout: 30_000 });
}

function syncProject(fixture: Fixture) {
  return spawnSync(process.execPath, [join(fixture.projectDir, fixture.leaf, "tools/aidlc-plugin.ts"), "sync", "--project-dir", fixture.projectDir], { cwd: fixture.projectDir, env: fixture.environment, encoding: "utf8", timeout: 30_000 });
}

function ownership(fixture: Fixture) {
  const sidecar: Record<string, { hook_registrations?: unknown }> = JSON.parse(readFileSync(join(fixture.projectDir, fixture.leaf, "tools/data/plugin-contrib-rin.json"), "utf8"));
  return projectedPluginHookContributionsSchema.parse(sidecar.$hooks?.hook_registrations);
}

function snapshot(root: string): Record<string, string> {
  return Object.fromEntries(readdirSync(root).filter((name) => name !== ".git").flatMap((name) => {
    const file = join(root, name);
    return statSync(file).isDirectory() ? Object.entries(snapshot(file)).map(([child, hash]) => [`${name}/${child}`, hash]) : [[name, createHash("sha256").update(readFileSync(file)).digest("hex")]];
  }));
}

function navigationTrust(fixture: Fixture): unknown {
  const hooks: { hooks: { PreToolUse: { hooks: { command: string }[] }[] } } = JSON.parse(readFileSync(join(fixture.projectDir, ".codex/hooks.json"), "utf8"));
  const index = hooks.hooks.PreToolUse.findIndex((group) => group.hooks.some((hook) => hook.command === "bun .codex/tools/aidlc.ts engine adapter codex rin-guard-navigation"));
  const parsed = parseToml(readFileSync(join(fixture.projectDir, ".codex/trust-seed.toml"), "utf8"));
  const hooksTable = parsed.hooks;
  if (hooksTable === null || typeof hooksTable !== "object" || Array.isArray(hooksTable) || hooksTable instanceof TomlDate) return null;
  const entries = hooksTable.state;
  if (entries === null || typeof entries !== "object" || Array.isArray(entries) || entries instanceof TomlDate) return null;
  return entries[`${join(fixture.projectDir, ".codex/hooks.json")}:pre_tool_use:${index}:0`];
}

function claudeConsumerSettingsFixture(): Fixture {
  const fixture = initializeSelected({ face: { harness: "claude", leaf: ".claude", nativeFile: ".claude/settings.json", navigationNeedle: "guard-navigation.mjs", skillFile: ".claude/skills/aidlc/SKILL.md" }, label: "edited-claude" });
  expect(fixture.initialization.status).toBe(0);
  expect(fixture.composition.status).toBe(0);
  const file = join(fixture.projectDir, fixture.nativeFile);
  writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), consumerPreference: "retain-me" }, null, 2)}\n`);
  return fixture;
}

function claudeOwnershipPreserved({ fixture, priorOwnership }: { fixture: Fixture; priorOwnership: unknown }): boolean {
  return Bun.deepEquals(ownership(fixture), priorOwnership);
}

function consumerPreference(fixture: Fixture): unknown {
  return JSON.parse(readFileSync(join(fixture.projectDir, fixture.nativeFile), "utf8")).consumerPreference;
}

describe("selected plugin core refresh", () => {
  test.each(faces)("$harness core refresh preserves native Rin registration and its body", (face) => {
    const fixture = initializeSelected({ face, label: `first-${face.harness}` });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status, fixture.composition.stderr).toBe(0);
    const priorOwnership = ownership(fixture);
    expect(priorOwnership.kind).toBe("parsed");
    expect(readFileSync(join(fixture.projectDir, fixture.nativeFile), "utf8")).toContain(face.navigationNeedle);
    const refreshed = configProject(fixture);
    expect(refreshed.status, refreshed.stdout + refreshed.stderr).toBe(0);
    expect(readFileSync(join(fixture.projectDir, fixture.nativeFile), "utf8")).toContain(face.navigationNeedle);
    expect(existsSync(join(fixture.projectDir, fixture.leaf, "hooks/guard-navigation.mjs"))).toBe(true);
    expect(ownership(fixture)).toEqual(priorOwnership);
  }, 120_000);

  test.each(faces)("$harness second core refresh retains proven native ownership", (face) => {
    const fixture = initializeSelected({ face, label: `second-${face.harness}` });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status).toBe(0);
    const priorOwnership = ownership(fixture);
    expect(priorOwnership.kind).toBe("parsed");
    const first = configProject(fixture);
    expect(first.status, first.stdout + first.stderr).toBe(0);
    const second = configProject(fixture);
    expect(second.status, second.stdout + second.stderr).toBe(0);
    expect(ownership(fixture)).toEqual(priorOwnership);
    expect(readFileSync(join(fixture.projectDir, fixture.nativeFile), "utf8")).toContain(face.navigationNeedle);
    expect(existsSync(join(fixture.projectDir, fixture.leaf, "hooks/guard-navigation.mjs"))).toBe(true);
  }, 120_000);

  test.each(faces.filter((face) => face.harness === "codex"))("$harness unrelated native settings edits refuse refresh without partial changes", (face) => {
    const fixture = initializeSelected({ face, label: `edited-${face.harness}` });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status).toBe(0);
    const file = join(fixture.projectDir, fixture.nativeFile);
    writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), consumerPreference: "retain-me" }, null, 2)}\n`);
    const before = snapshot(fixture.projectDir);
    const refreshed = configProject(fixture);
    expect(refreshed.status).not.toBe(0);
    expect(refreshed.stdout + refreshed.stderr).toContain("conflict");
    expect(snapshot(fixture.projectDir)).toEqual(before);
  }, 120_000);

  test("Claude core refresh preserves unrelated settings and selected native ownership", () => {
    const fixture = claudeConsumerSettingsFixture();
    const priorOwnership = ownership(fixture);
    expect(priorOwnership.kind).toBe("parsed");
    const refreshed = configProject(fixture);
    expect(refreshed.status, refreshed.stdout + refreshed.stderr).toBe(0);
    expect(consumerPreference(fixture)).toBe("retain-me");
    expect(claudeOwnershipPreserved({ fixture, priorOwnership })).toBe(true);
    expect(readFileSync(join(fixture.projectDir, fixture.nativeFile), "utf8")).toContain("guard-navigation.mjs");
    expect(existsSync(join(fixture.projectDir, fixture.leaf, "hooks/guard-navigation.mjs"))).toBe(true);
  }, 120_000);

  test("Codex repeated core refresh binds trust to the final consumer hook indices", () => {
    const fixture = initializeSelected({ face: { harness: "codex", leaf: ".codex", nativeFile: ".codex/hooks.json", navigationNeedle: "rin-guard-navigation", skillFile: ".agents/skills/aidlc/SKILL.md" }, label: "trust-codex" });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status).toBe(0);
    const first = configProject(fixture);
    expect(first.status, first.stdout + first.stderr).toBe(0);
    const second = configProject(fixture);
    expect(second.status, second.stdout + second.stderr).toBe(0);
    expect(navigationTrust(fixture)).toEqual({ trusted_hash: navigationTrustHash });
  }, 120_000);

  test("core refresh proof remains valid after selected native hook rename and real sync", () => {
    const pluginRoot = join(scratch, "renamed-claude-projection");
    cpSync(join(REPO_ROOT, "dist/plugins/rin/claude"), pluginRoot, { recursive: true });
    const fixture = initializeSelected({ face: { harness: "claude", leaf: ".claude", nativeFile: ".claude/settings.json", navigationNeedle: "guard-navigation.mjs", skillFile: ".claude/skills/aidlc/SKILL.md" }, label: "rename-after-refresh", pluginRoot });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status).toBe(0);
    const first = configProject(fixture);
    expect(first.status, first.stdout + first.stderr).toBe(0);
    const baseline = syncProject(fixture);
    expect(baseline.status, baseline.stdout + baseline.stderr).toBe(0);
    cpSync(join(pluginRoot, "hooks/guard-navigation.mjs"), join(pluginRoot, "hooks/renamed-navigation.mjs"));
    rmSync(join(pluginRoot, "hooks/guard-navigation.mjs"));
    const payloadPath = join(pluginRoot, "contributions/hook-registrations.json");
    writeFileSync(payloadPath, readFileSync(payloadPath, "utf8").replaceAll("guard-navigation.mjs", "renamed-navigation.mjs"));
    const synchronized = syncProject(fixture);
    expect(synchronized.status, synchronized.stdout + synchronized.stderr).toBe(0);
    const second = configProject(fixture);
    expect(second.status, second.stdout + second.stderr).toBe(0);
    expect(readFileSync(join(fixture.projectDir, fixture.nativeFile), "utf8")).toContain("renamed-navigation.mjs");
    expect(readFileSync(join(fixture.projectDir, fixture.nativeFile), "utf8")).not.toContain("guard-navigation.mjs");
    expect(existsSync(join(fixture.projectDir, ".claude/hooks/renamed-navigation.mjs"))).toBe(true);
    expect(existsSync(join(fixture.projectDir, ".claude/hooks/guard-navigation.mjs"))).toBe(false);
    expect(ownership(fixture).kind).toBe("parsed");
  }, 120_000);

  test("modified proven native hook entries refuse core refresh atomically", () => {
    const fixture = initializeSelected({ face: { harness: "claude", leaf: ".claude", nativeFile: ".claude/settings.json", navigationNeedle: "guard-navigation.mjs", skillFile: ".claude/skills/aidlc/SKILL.md" }, label: "modified-owned-native" });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status).toBe(0);
    const file = join(fixture.projectDir, fixture.nativeFile);
    writeFileSync(file, readFileSync(file, "utf8").replace("guard-navigation.mjs", "consumer-edited-navigation.mjs"));
    const before = snapshot(fixture.projectDir);
    const refreshed = configProject(fixture);
    expect(refreshed.status).not.toBe(0);
    expect(refreshed.stdout + refreshed.stderr).toContain("conflict");
    expect(snapshot(fixture.projectDir)).toEqual(before);
  }, 120_000);
});

describe("composed root skill ownership baseline", () => {
  test.each(faces)("$harness refresh binds the final compiled skill tables", (face) => {
    const fixture = initializeSelected({ face, label: `skill-baseline-${face.harness}` });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status, fixture.composition.stderr).toBe(0);
    const refreshed = configProject(fixture);
    expect(refreshed.status, refreshed.stdout + refreshed.stderr).toBe(0);
    const skill = face.skillFile;
    const baseline = JSON.parse(readFileSync(join(fixture.projectDir, face.leaf, "tools/data/aidlc-manifest.json"), "utf8"));
    const observed = `sha256:${createHash("sha256").update(readFileSync(join(fixture.projectDir, skill))).digest("hex")}`;
    expect(baseline.files[skill]).toBe(observed);
    const repeated = configProject(fixture);
    expect(repeated.status, repeated.stdout + repeated.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(fixture.projectDir, face.leaf, "tools/data/aidlc-manifest.json"), "utf8")).files[skill]).toBe(observed);
    expect(`sha256:${createHash("sha256").update(readFileSync(join(fixture.projectDir, skill))).digest("hex")}`).toBe(observed);
  }, 120_000);

  test.each(faces)("$harness prose edits cannot be absorbed into the core baseline", (face) => {
    const fixture = initializeSelected({ face, label: `skill-prose-${face.harness}` });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status, fixture.composition.stderr).toBe(0);
    const refreshed = configProject(fixture);
    expect(refreshed.status, refreshed.stdout + refreshed.stderr).toBe(0);
    const skill = face.skillFile;
    const manifest = join(fixture.projectDir, face.leaf, "tools/data/aidlc-manifest.json");
    const priorManifest = readFileSync(manifest, "utf8");
    const edited = `${readFileSync(join(fixture.projectDir, skill), "utf8")}\nUser-owned orchestration instruction.\n`;
    writeFileSync(join(fixture.projectDir, skill), edited);
    const refused = configProject(fixture);
    expect(refused.status).toBe(4);
    expect(refused.stdout + refused.stderr).toContain("locally modified or unowned");
    expect(readFileSync(manifest, "utf8")).toBe(priorManifest);
    expect(readFileSync(join(fixture.projectDir, skill), "utf8")).toBe(edited);
  }, 120_000);
});

function sensorAdoptionFixture(input: { label: string; unrelatedEdit?: string; declared?: string[] }) {
  const face: Face = { harness: "codex", leaf: ".codex", nativeFile: ".codex/hooks.json", navigationNeedle: "rin-guard-navigation", skillFile: ".agents/skills/aidlc/SKILL.md" };
  const fixture = initializeSelected({ face, label: input.label });
  expect(fixture.initialization.status, fixture.initialization.stdout + fixture.initialization.stderr).toBe(0);
  expect(fixture.composition.status, fixture.composition.stdout + fixture.composition.stderr).toBe(0);
  const source = join(scratch, `${input.label}-plugin-source`, "selected-sensors");
  const pluginRoot = join(scratch, `${input.label}-plugin-built`);
  mkdirSync(join(source, ".aidlc-plugin"), { recursive: true });
  mkdirSync(join(source, "contributions/construction"), { recursive: true });
  writeFileSync(join(source, ".aidlc-plugin/plugin.json"), JSON.stringify({ name: "selected-sensors", version: "0.1.0", description: "Selected sensor adoption fixture", dependencies: ["core"], aidlc: { contributes: { overlays: "contributions/" } } }));
  writeFileSync(join(source, "contributions/construction/code-generation.md"), `---\ntarget: code-generation\nplugin: selected-sensors\nadds:\n  sensors:\n${(input.declared ?? ["cd-44", "carve-out-decay", "linter"]).map((sensor) => `    - ${sensor}\n`).join("")}---\n`);
  const build = spawnSync(process.execPath, [join(REPO_ROOT, "dist/codex/.codex/tools/aidlc-plugin-build.ts"), source, "codex", pluginRoot, "--json"], { cwd: fixture.projectDir, env: fixture.environment, encoding: "utf8", timeout: 30_000 });
  const environment = { ...fixture.environment, AIDLC_PLUGIN_ROOT: pluginRoot, PLUGIN_ROOT: pluginRoot, CLAUDE_PLUGIN_ROOT: pluginRoot };
  const stageFile = join(fixture.projectDir, ".codex/aidlc-common/stages/construction/code-generation.md");
  const initialStage = readFileSync(stageFile, "utf8").replaceAll("\r\n", "\n");
  writeFileSync(stageFile, initialStage.replace("sensors:\n  - required-sections\n  - traceability\n", "sensors:\n  - required-sections\n  - traceability\n  - cd-44\n  - carve-out-decay\n  - linter\n") + (input.unrelatedEdit ?? ""));
  const select = spawnSync(process.execPath, [join(REPO_ROOT, "core/tools/aidlc-utility.ts"), "select-plugins", "aidlc,rin,selected-sensors"], { cwd: fixture.projectDir, env: environment, encoding: "utf8", timeout: 30_000 });
  const selectedFixture = { ...fixture, pluginRoot, environment };
  const sync = spawnSync(process.execPath, [join(REPO_ROOT, "core/tools/aidlc-plugin.ts"), "sync", "--project-dir", fixture.projectDir, "--json"], { cwd: fixture.projectDir, env: environment, encoding: "utf8", timeout: 30_000 });
  return { fixture: selectedFixture, initialStage, stageFile, build, select, sync };
}

function selectedSensorRecord(fixture: Fixture): unknown {
  return JSON.parse(readFileSync(join(fixture.projectDir, ".codex/tools/data/plugin-contrib-selected-sensors.json"), "utf8"))["code-generation"];
}

function selectedSensors(fixture: Fixture): unknown {
  const graph: Array<{ slug: string; sensors: unknown }> = JSON.parse(readFileSync(join(fixture.projectDir, ".codex/tools/data/stage-graph.json"), "utf8"));
  return graph.find((stage) => stage.slug === "code-generation")?.sensors;
}

function modifiedStockRelease(fixture: Fixture): string {
  const source = join(scratch, `next-release-${fixture.harness}-${fixture.projectDir.split(/[\\/]/).at(-1)}`);
  cpSync(join(REPO_ROOT, "dist", fixture.harness), source, { recursive: true });
  const skill = join(source, fixture.skillFile);
  writeFileSync(skill, readFileSync(skill, "utf8").replace(/(<!-- BEGIN: compiled stage graph[^\n]* -->\n)/, "$1Next release generated table row.\n") + "\nNext release orchestration prose.\n");
  return source;
}

function refreshFrom(fixture: Fixture, source: string) {
  return spawnSync(process.execPath, [join(REPO_ROOT, "core/tools/aidlc-init.ts"), "config", "--from", source, "--project-dir", fixture.projectDir], { cwd: fixture.projectDir, env: fixture.environment, encoding: "utf8", timeout: 30_000 });
}

describe("sensor customization adoption and generated skill upgrade ownership", () => {
  test("authentic contribution adoption preserves existing bindings through two stock refreshes", () => {
    const result = sensorAdoptionFixture({ label: "adopt-selected" });
    expect(result.fixture.initialization.status).toBe(0);
    expect(result.build.status, result.build.stdout + result.build.stderr).toBe(0);
    expect(result.select.status, result.select.stdout + result.select.stderr).toBe(0);
    expect(result.sync.status, result.sync.stdout + result.sync.stderr).toBe(0);
    expect(selectedSensorRecord(result.fixture)).toMatchObject({ sensor_adoption: { sensors: ["cd-44", "carve-out-decay", "linter"] }, sensors: ["carve-out-decay", "cd-44", "linter"] });
    const stage = readFileSync(result.stageFile, "utf8");
    writeFileSync(result.stageFile, stage.replace("  - linter\n", ""));
    const first = configProject(result.fixture);
    expect(first.status, first.stdout + first.stderr).toBe(0);
    expect(readFileSync(result.stageFile, "utf8")).toBe(stage);
    const second = configProject(result.fixture);
    expect(second.status, second.stdout + second.stderr).toBe(0);
    expect(readFileSync(result.stageFile, "utf8")).toBe(stage);
    expect(selectedSensors(result.fixture)).toEqual(["required-sections", "traceability", "cd-44", "carve-out-decay", "linter"]);
    expect(JSON.parse(readFileSync(join(result.fixture.projectDir, ".codex/tools/data/harness.json"), "utf8")).plugins).toEqual(["aidlc", "rin", "selected-sensors"]);
    expect(JSON.parse(readFileSync(join(result.fixture.projectDir, ".codex/tools/data/plugin-owned-selected-sensors.json"), "utf8")).files).toEqual([]);
    writeFileSync(result.stageFile, stage.replace("  - linter\n", ""));
    const changed = snapshot(result.fixture.projectDir);
    const refusedRemoval = configProject(result.fixture);
    expect(refusedRemoval.status).toBe(4);
    expect(snapshot(result.fixture.projectDir)).toEqual(changed);
    writeFileSync(result.stageFile, stage);
    const disabled = spawnSync(process.execPath, [join(REPO_ROOT, "core/tools/aidlc-utility.ts"), "select-plugins", "aidlc,rin"], { cwd: result.fixture.projectDir, env: result.fixture.environment, encoding: "utf8", timeout: 30_000 });
    expect(disabled.status, disabled.stdout + disabled.stderr).toBe(0);
    expect(readFileSync(result.stageFile, "utf8")).toBe(result.initialStage);
  }, 120_000);

  test("unrelated stage edits cannot mint sensor-adoption provenance or change a refused refresh", () => {
    const result = sensorAdoptionFixture({ label: "adopt-stage-edit", unrelatedEdit: "\nConsumer stage instructions.\n" });
    expect(result.build.status).toBe(0);
    expect(result.select.status).toBe(0);
    expect(result.sync.status).toBe(0);
    expect(existsSync(join(result.fixture.projectDir, ".codex/tools/data/plugin-contrib-selected-sensors.json"))).toBe(false);
    const before = snapshot(result.fixture.projectDir);
    const refused = configProject(result.fixture);
    expect(refused.status).toBe(4);
    expect(snapshot(result.fixture.projectDir)).toEqual(before);
  }, 120_000);

  test("an incomplete sensor declaration cannot absorb undeclared manual bindings", () => {
    const result = sensorAdoptionFixture({ label: "adopt-incomplete", declared: ["cd-44", "linter"] });
    expect(result.build.status).toBe(0);
    expect(result.select.status).toBe(0);
    expect(result.sync.status).toBe(0);
    expect(existsSync(join(result.fixture.projectDir, ".codex/tools/data/plugin-contrib-selected-sensors.json"))).toBe(false);
    const before = snapshot(result.fixture.projectDir);
    const refused = configProject(result.fixture);
    expect(refused.status).toBe(4);
    expect(snapshot(result.fixture.projectDir)).toEqual(before);
  }, 120_000);

  test.each(faces)("$harness legacy ownership uses a genuine prior-stock refresh bridge", (face) => {
    const fixture = initializeSelected({ face, label: `legacy-bridge-${face.harness}` });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status).toBe(0);
    const manifestPath = join(fixture.projectDir, fixture.leaf, "tools/data/aidlc-manifest.json");
    const legacy = JSON.parse(readFileSync(manifestPath, "utf8"));
    delete legacy.generatedSkillProseHashes;
    writeFileSync(manifestPath, `${JSON.stringify(legacy, null, 2)}\n`);
    const release = modifiedStockRelease({ ...fixture, harness: face.harness });
    const before = snapshot(fixture.projectDir);
    const refused = refreshFrom(fixture, release);
    expect(refused.status).toBe(4);
    expect(snapshot(fixture.projectDir)).toEqual(before);
    const bridge = configProject(fixture);
    expect(bridge.status, bridge.stdout + bridge.stderr).toBe(0);
    expect(JSON.parse(readFileSync(manifestPath, "utf8")).generatedSkillProseHashes).toMatchObject({ [face.skillFile]: expect.stringMatching(/^sha256:[a-f0-9]{64}$/) });
    const upgraded = refreshFrom(fixture, release);
    expect(upgraded.status, upgraded.stdout + upgraded.stderr).toBe(0);
  }, 120_000);

  test.each(faces)("$harness cross-release tables upgrade after composition without claiming user prose", (face) => {
    const fixture = initializeSelected({ face, label: `cross-release-${face.harness}` });
    expect(fixture.initialization.status).toBe(0);
    expect(fixture.composition.status).toBe(0);
    const release = modifiedStockRelease(fixture);
    const upgraded = refreshFrom(fixture, release);
    expect(upgraded.status, upgraded.stdout + upgraded.stderr).toBe(0);
    expect(readFileSync(join(fixture.projectDir, fixture.skillFile), "utf8")).toContain("Next release orchestration prose.");
    const repeated = refreshFrom(fixture, release);
    expect(repeated.status, repeated.stdout + repeated.stderr).toBe(0);
    const edited = `${readFileSync(join(fixture.projectDir, fixture.skillFile), "utf8")}\nConsumer-only prose.\n`;
    writeFileSync(join(fixture.projectDir, fixture.skillFile), edited);
    const before = snapshot(fixture.projectDir);
    const refused = refreshFrom(fixture, release);
    expect(refused.status).toBe(4);
    expect(snapshot(fixture.projectDir)).toEqual(before);
  }, 120_000);
});
