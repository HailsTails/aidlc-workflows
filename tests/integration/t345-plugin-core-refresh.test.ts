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

type Face = { harness: "claude" | "codex"; leaf: string; nativeFile: string; navigationNeedle: string };
type Fixture = Face & { projectDir: string; pluginRoot: string; environment: NodeJS.ProcessEnv; initialization: SpawnSyncReturns<string>; composition: PluginComposeRunResult };

const faces: Face[] = [
  { harness: "claude", leaf: ".claude", nativeFile: ".claude/settings.json", navigationNeedle: "guard-navigation.mjs" },
  { harness: "codex", leaf: ".codex", nativeFile: ".codex/hooks.json", navigationNeedle: "rin-guard-navigation" },
];
const scratch = mkdtempSync(join(tmpdir(), "aidlc-t345-"));
const navigationTrustHash = `sha256:${createHash("sha256").update('{"event_name":"pre_tool_use","hooks":[{"async":false,"command":"bun .codex/tools/aidlc.ts engine adapter codex rin-guard-navigation","timeout":600,"type":"command"}]}').digest("hex")}`;

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function initializeSelected({ face, label, pluginRoot = join(REPO_ROOT, "dist/plugins/rin", face.harness) }: { face: Face; label: string; pluginRoot?: string }): Fixture {
  const projectDir = join(scratch, label);
  mkdirSync(join(projectDir, ".git"), { recursive: true });
  const environment: NodeJS.ProcessEnv = { ...process.env, AIDLC_PROJECT_DIR: projectDir, CLAUDE_PROJECT_DIR: projectDir, AIDLC_HARNESS_DIR: face.leaf, AIDLC_HARNESS_NAME: face.harness, CLAUDE_PLUGIN_ROOT: pluginRoot, PLUGIN_ROOT: pluginRoot, AIDLC_PLUGIN_ROOT: pluginRoot };
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

  test.each(faces)("$harness unrelated native settings edits refuse refresh without partial changes", (face) => {
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

  test("Codex repeated core refresh binds trust to the final consumer hook indices", () => {
    const fixture = initializeSelected({ face: { harness: "codex", leaf: ".codex", nativeFile: ".codex/hooks.json", navigationNeedle: "rin-guard-navigation" }, label: "trust-codex" });
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
    const fixture = initializeSelected({ face: { harness: "claude", leaf: ".claude", nativeFile: ".claude/settings.json", navigationNeedle: "guard-navigation.mjs" }, label: "rename-after-refresh", pluginRoot });
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
    const fixture = initializeSelected({ face: { harness: "claude", leaf: ".claude", nativeFile: ".claude/settings.json", navigationNeedle: "guard-navigation.mjs" }, label: "modified-owned-native" });
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
