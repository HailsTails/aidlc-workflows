import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseToml, TomlDate } from "smol-toml";
import { REPO_ROOT } from "../harness/fixtures.ts";
import type { ShippedHarnessName } from "../harness/harness-matrix.ts";
import { composePluginFixture } from "../harness/plugin-kit.ts";
import { runPluginCompose } from "../../dist/claude/.claude/tools/aidlc-plugin-test.ts";

type NativeFace = { harness: ShippedHarnessName; leaf: string; registry: string };
type Fixture = NativeFace & { projectDir: string; pluginBuilt: string; environment: NodeJS.ProcessEnv; dropLogs?: string };

const faces: readonly NativeFace[] = [
  { harness: "claude", leaf: ".claude", registry: ".claude/settings.json" },
  { harness: "codex", leaf: ".codex", registry: ".codex/hooks/plugin-hook-targets.json" },
  { harness: "copilot", leaf: ".aidlc", registry: ".aidlc/hooks/plugin-hook-targets.json" },
  { harness: "cursor", leaf: ".cursor", registry: ".cursor/hooks/plugin-hook-targets.json" },
  { harness: "opencode", leaf: ".aidlc", registry: ".aidlc/hooks/plugin-hook-rows.json" },
];
const scratch = mkdtempSync(join(tmpdir(), "aidlc-t344-"));
const cursor: NativeFace = { harness: "cursor", leaf: ".cursor", registry: ".cursor/hooks/plugin-hook-targets.json" };
const codex: NativeFace = { harness: "codex", leaf: ".codex", registry: ".codex/hooks/plugin-hook-targets.json" };
const navigationTrustHash = `sha256:${createHash("sha256").update('{"event_name":"pre_tool_use","hooks":[{"async":false,"command":"bun .codex/tools/aidlc.ts engine adapter codex rin-guard-navigation","timeout":600,"type":"command"}]}').digest("hex")}`;

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function selectedFixture(face: NativeFace, name: string, environment: NodeJS.ProcessEnv = {}, prepareProjection?: (pluginBuilt: string) => void): Fixture {
  const pluginBuilt = join(scratch, `${name}-projection`);
  cpSync(join(REPO_ROOT, "dist", "plugins", "rin", face.harness), pluginBuilt, { recursive: true });
  prepareProjection?.(pluginBuilt);
  const composed = composePluginFixture({
    plugin: "rin", harness: face.harness, projectDir: join(scratch, name), pluginBuilt, env: environment,
    beforeCompose: ({ projectDir }) => {
      mkdirSync(join(projectDir, ".git"), { recursive: true });
      const file = join(projectDir, face.leaf, "tools", "data", "harness.json");
      writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, "utf-8")), plugins: ["aidlc", "rin"] }, null, 2)}\n`);
      seedConsumerRegistration({ ...face, projectDir, pluginBuilt, environment });
    },
  });
  const fixture = { ...face, projectDir: composed.projectDir, pluginBuilt, environment, dropLogs: composed.dropLogs };
  return fixture;
}

function seedConsumerRegistration(fixture: Fixture): void {
  const file = join(fixture.projectDir, fixture.registry);
  const parsed = JSON.parse(readFileSync(file, "utf-8"));
  if (fixture.harness === "opencode") parsed.push({ event: "UserPromptSubmit", target: "consumer-entry", hookFile: "consumer.ts", pluginName: "consumer" });
  else if (fixture.harness === "cursor") parsed.ConsumerEvent = ["consumer-entry"];
  else parsed.consumerEntry = "consumer-entry";
  writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`);
  if (fixture.harness === "codex") {
    const hooksFile = join(fixture.projectDir, ".codex", "hooks.json");
    const hooks = JSON.parse(readFileSync(hooksFile, "utf-8"));
    hooks.hooks.PreToolUse.unshift({ hooks: [{ type: "command", command: "consumer-entry" }] });
    writeFileSync(hooksFile, `${JSON.stringify(hooks, null, 2)}\n`);
  }
}

function syncFixture(fixture: Fixture) {
  return spawnSync(process.execPath, [join(fixture.projectDir, fixture.leaf, "tools", "aidlc-plugin.ts"), "sync", "--project-dir", fixture.projectDir], {
    cwd: fixture.projectDir, encoding: "utf-8", timeout: 60_000,
    env: {
      ...process.env, AIDLC_PROJECT_DIR: fixture.projectDir, CLAUDE_PROJECT_DIR: fixture.projectDir,
      AIDLC_HARNESS_DIR: fixture.leaf, AIDLC_HARNESS_NAME: fixture.harness,
      CLAUDE_PLUGIN_ROOT: fixture.pluginBuilt, PLUGIN_ROOT: fixture.pluginBuilt, AIDLC_PLUGIN_ROOT: fixture.pluginBuilt,
      ...fixture.environment,
    },
  });
}

function ownedFixture(face: NativeFace, name: string, environment: NodeJS.ProcessEnv = {}): Fixture {
  const fixture = selectedFixture(face, name, environment);
  expect(registry(fixture), fixture.dropLogs).toContain("guard-navigation.mjs");
  const result = syncFixture(fixture);
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return fixture;
}

function renameProjection(fixture: Fixture): void {
  cpSync(join(fixture.pluginBuilt, "hooks", "guard-navigation.mjs"), join(fixture.pluginBuilt, "hooks", "renamed-navigation.mjs"));
  rmSync(join(fixture.pluginBuilt, "hooks", "guard-navigation.mjs"));
  const file = join(fixture.pluginBuilt, "contributions", "hook-registrations.json");
  writeFileSync(file, readFileSync(file, "utf-8").replaceAll("guard-navigation.mjs", "renamed-navigation.mjs"));
}

function registry(fixture: Fixture): string {
  return readFileSync(join(fixture.projectDir, fixture.registry), "utf-8");
}

function sidecar(fixture: Fixture): string {
  return readFileSync(join(fixture.projectDir, fixture.leaf, "tools", "data", "plugin-contrib-rin.json"), "utf-8");
}

function disableSelection(fixture: Fixture): void {
  const file = join(fixture.projectDir, fixture.leaf, "tools", "data", "harness.json");
  writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, "utf-8")), plugins: ["aidlc"] }, null, 2)}\n`);
}

function removeRecordedCursorNavigation(fixture: Fixture): void {
  const file = join(fixture.projectDir, fixture.registry);
  const parsed: { PreToolUse: string[] } = JSON.parse(readFileSync(file, "utf-8"));
  parsed.PreToolUse = parsed.PreToolUse.filter((hookFile) => hookFile !== "guard-navigation.mjs");
  writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`);
}

function snapshot(root: string): Record<string, string> {
  if (!existsSync(root)) return {};
  return Object.fromEntries(readdirSync(root).filter((name) => name !== ".git").flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) return Object.entries(snapshot(path)).map(([child, hash]) => [`${name}/${child}`, hash]);
    return [[name, createHash("sha256").update(readFileSync(path)).digest("hex")]];
  }));
}

function authoredPluginSurfaces(fixture: Fixture) {
  return {
    agents: snapshot(join(fixture.projectDir, fixture.leaf, "agents")),
    tools: snapshot(join(fixture.projectDir, fixture.leaf, "tools", "rin-gates")),
    stages: snapshot(join(fixture.projectDir, fixture.leaf, "stages")),
  };
}

function navigationTrustEntry(fixture: Fixture): unknown {
  const hooks: { hooks: { PreToolUse: { hooks: { command: string }[] }[] } } = JSON.parse(readFileSync(join(fixture.projectDir, ".codex", "hooks.json"), "utf-8"));
  const index = hooks.hooks.PreToolUse.findIndex((group) => group.hooks.some((hook) => hook.command === "bun .codex/tools/aidlc.ts engine adapter codex rin-guard-navigation"));
  expect(index).toBeGreaterThanOrEqual(0);
  const parsed = parseToml(readFileSync(join(fixture.projectDir, ".codex", "trust-seed.toml"), "utf-8"));
  const state = parsed["hooks"];
  if (typeof state !== "object" || state === null || Array.isArray(state) || state instanceof TomlDate) return null;
  const entries = state["state"];
  if (typeof entries !== "object" || entries === null || Array.isArray(entries) || entries instanceof TomlDate) return null;
  return entries[`${join(fixture.projectDir, ".codex", "hooks.json")}:pre_tool_use:${index}:0`];
}

describe("native plugin hook transactions", () => {
  test("selected Copilot personas with unknown explicit tools are refused without broad fallback", () => {
    const fixture = selectedFixture({ harness: "copilot", leaf: ".aidlc", registry: ".aidlc/hooks/plugin-hook-targets.json" }, "unknown-tool-copilot", {}, (pluginBuilt) => {
      const file = join(pluginBuilt, "agents", "rin-commit-check-agent.md");
      writeFileSync(file, readFileSync(file, "utf-8").replace(/^tools:.*$/m, "tools: Read, UnknownTool"));
    });
    expect(existsSync(join(fixture.projectDir, ".github", "agents", "rin-commit-check-agent.md"))).toBe(false);
    expect(fixture.dropLogs).toContain("rin-commit-check-agent.md");
    expect(fixture.dropLogs).toContain("tools");
  }, 120_000);

  test("selected Copilot read-only reviewers receive only native read and search capabilities", () => {
    const fixture = selectedFixture({ harness: "copilot", leaf: ".aidlc", registry: ".aidlc/hooks/plugin-hook-targets.json" }, "readonly-copilot");
    const file = join(fixture.projectDir, ".github", "agents", "rin-commit-check-agent.md");
    expect(existsSync(file), fixture.dropLogs).toBe(true);
    const frontmatter = readFileSync(file, "utf-8").match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
    const tools: unknown = JSON.parse(frontmatter.match(/^tools:\s*(.*)$/m)?.[1] ?? "null");
    expect(tools).toEqual(["read", "search"]);
  }, 120_000);

  test.each([...faces])("$harness sync removes the renamed prior native entry and unchanged owned body", (face) => {
    const fixture = ownedFixture(face, `rename-${face.harness}`);
    renameProjection(fixture);
    const result = syncFixture(fixture);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(registry(fixture)).not.toContain("guard-navigation.mjs");
    expect(registry(fixture)).toContain("renamed-navigation.mjs");
    expect(registry(fixture)).toContain("consumer-entry");
    expect(existsSync(join(fixture.projectDir, fixture.leaf, "hooks", "guard-navigation.mjs"))).toBe(false);
    expect(existsSync(join(fixture.projectDir, fixture.leaf, "hooks", "renamed-navigation.mjs"))).toBe(true);
  }, 120_000);

  test.each([...faces])("$harness deselection removes recorded registrations and unchanged bodies", (face) => {
    const fixture = ownedFixture(face, `disable-${face.harness}`);
    disableSelection(fixture);
    const result = syncFixture(fixture);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(registry(fixture)).not.toContain("guard-navigation.mjs");
    expect(registry(fixture)).toContain("consumer-entry");
    expect(existsSync(join(fixture.projectDir, fixture.leaf, "hooks", "guard-navigation.mjs"))).toBe(false);
  }, 120_000);

  test("repeated selected composition retains prior registration ownership without changing bytes", () => {
    const fixture = ownedFixture(cursor, "repeat-cursor");
    const priorSidecar = sidecar(fixture);
    const priorRegistry = registry(fixture);
    const result = runPluginCompose({ harness: "cursor", harnessLeaf: ".cursor", projectDir: fixture.projectDir, pluginBuilt: fixture.pluginBuilt });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(sidecar(fixture)).toBe(priorSidecar);
    expect(registry(fixture)).toBe(priorRegistry);
  }, 120_000);

  test("a retained bootstrap after deselection does not reinstall plugin bodies or registrations", () => {
    const fixture = ownedFixture(cursor, "disabled-bootstrap-cursor");
    disableSelection(fixture);
    const disabled = syncFixture(fixture);
    expect(disabled.status, disabled.stdout + disabled.stderr).toBe(0);
    const before = registry(fixture);
    const beforeSurfaces = authoredPluginSurfaces(fixture);
    const result = runPluginCompose({ harness: "cursor", harnessLeaf: ".cursor", projectDir: fixture.projectDir, pluginBuilt: fixture.pluginBuilt });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(registry(fixture)).toBe(before);
    expect(existsSync(join(fixture.projectDir, ".cursor", "hooks", "guard-navigation.mjs"))).toBe(false);
    expect(authoredPluginSurfaces(fixture)).toEqual(beforeSurfaces);
  }, 120_000);

  test("an unchanged projection refuses a modified recorded Cursor entry without partial project changes", () => {
    const fixture = ownedFixture(cursor, "unchanged-conflict-cursor");
    writeFileSync(join(fixture.projectDir, fixture.registry), registry(fixture).replace("guard-navigation.mjs", "operator-edited.mjs"));
    const before = snapshot(fixture.projectDir);
    const result = syncFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("missing-owned-value");
    expect(snapshot(fixture.projectDir)).toEqual(before);
  }, 120_000);

  test("an unchanged projection refuses a missing recorded Cursor entry without inferring a manual deletion", () => {
    const fixture = ownedFixture(cursor, "unchanged-missing-cursor");
    removeRecordedCursorNavigation(fixture);
    const before = snapshot(fixture.projectDir);
    const result = syncFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("missing-owned-value");
    expect(snapshot(fixture.projectDir)).toEqual(before);
  }, 120_000);

  test("a modified recorded Cursor entry refuses sync without partial project changes", () => {
    const fixture = ownedFixture(cursor, "conflict-cursor");
    writeFileSync(join(fixture.projectDir, fixture.registry), registry(fixture).replace("guard-navigation.mjs", "operator-edited.mjs"));
    renameProjection(fixture);
    const before = snapshot(fixture.projectDir);
    const result = syncFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("missing-owned-value");
    expect(snapshot(fixture.projectDir)).toEqual(before);
  }, 120_000);

  test("a missing recorded Cursor entry refuses sync without inferring a manual deletion", () => {
    const fixture = ownedFixture(cursor, "missing-cursor");
    removeRecordedCursorNavigation(fixture);
    renameProjection(fixture);
    const before = snapshot(fixture.projectDir);
    const result = syncFixture(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("missing-owned-value");
    expect(snapshot(fixture.projectDir)).toEqual(before);
  }, 120_000);

  test("Codex trust seed follows final registered indices and leaves user config untouched", () => {
    const hostRoot = join(scratch, "codex-host");
    mkdirSync(hostRoot, { recursive: true });
    const hostConfig = join(hostRoot, "config.toml");
    writeFileSync(hostConfig, 'model = "consumer-model"\n');
    const fixture = ownedFixture(codex, "trust-codex", { CODEX_HOME: hostRoot });
    expect(navigationTrustEntry(fixture)).toEqual({ trusted_hash: navigationTrustHash });
    expect(readFileSync(hostConfig, "utf-8")).toBe('model = "consumer-model"\n');
  }, 120_000);
});
