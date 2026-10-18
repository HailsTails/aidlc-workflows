import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { composePluginFixture } from "../harness/plugin-kit.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";
import { hermeticGitEnvironment } from "../../plugins/rin/tools/hermetic-git/index.ts";

const scratch = mkdtempSync(join(tmpdir(), "aidlc-t343-"));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function projectedRegistrations(harness: string): unknown {
  const file = join(REPO_ROOT, "dist", "plugins", "rin", harness, "contributions", "hook-registrations.json");
  expect(existsSync(file), `projected hook registrations missing for ${harness}`).toBe(true);
  return JSON.parse(readFileSync(file, "utf-8"));
}

function selectedCursorProject(name: string): string {
  const fixture = composePluginFixture({
    plugin: "rin",
    harness: "cursor",
    projectDir: join(scratch, name),
    pluginBuilt: join(REPO_ROOT, "dist", "plugins", "rin", "cursor"),
    beforeCompose: ({ projectDir }) => {
      mkdirSync(join(projectDir, ".git"), { recursive: true });
      const file = join(projectDir, ".cursor", "tools", "data", "harness.json");
      const settings = JSON.parse(readFileSync(file, "utf-8"));
      writeFileSync(file, `${JSON.stringify({ ...settings, plugins: ["aidlc", "rin"] }, null, 2)}\n`);
    },
  });
  return fixture.projectDir;
}

function cursorGuard(root: string): unknown {
  const result = spawnSync(process.execPath, [join(root, ".cursor", "hooks", "aidlc-cursor-adapter.ts"), "guards"], {
    cwd: root,
    encoding: "utf-8",
    env: { ...process.env, AIDLC_PROJECT_DIR: root, AIDLC_HARNESS_DIR: ".cursor" },
    input: JSON.stringify({
      hook_event_name: "preToolUse",
      tool_name: "Shell",
      tool_input: { command: "echo hook-selection-probe", cwd: root },
      cwd: root,
      workspace_roots: [root],
      session_id: "selected-cursor-session",
      conversation_id: "selected-cursor-session",
    }),
    timeout: 30_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe("selected plugin hook composition", () => {
  test("Claude projection carries the native navigation matcher and body command", () => {
    expect(projectedRegistrations("claude")).toEqual(expect.objectContaining({
      schemaVersion: 1, pluginName: "rin", harness: "claude",
      registrations: expect.arrayContaining([{
        kind: "group", path: ".claude/settings.json", event: "PreToolUse",
        group: { matcher: "Bash|PowerShell", hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-navigation.mjs"' }] },
      }]),
    }));
  });

  test("Codex projection carries its existing adapter target to the projected body", () => {
    expect(projectedRegistrations("codex")).toEqual(expect.objectContaining({
      schemaVersion: 1, pluginName: "rin", harness: "codex",
      registrations: expect.arrayContaining([{ kind: "target", path: ".codex/hooks/plugin-hook-targets.json", target: "rin-guard-navigation", hookFile: "guard-navigation.mjs" }]),
    }));
  });

  test("Copilot projection carries its existing adapter target to the projected body", () => {
    expect(projectedRegistrations("copilot")).toEqual(expect.objectContaining({
      schemaVersion: 1, pluginName: "rin", harness: "copilot",
      registrations: expect.arrayContaining([{ kind: "target", path: ".aidlc/hooks/plugin-hook-targets.json", target: "rin-guard-navigation", hookFile: "guard-navigation.mjs" }]),
    }));
  });

  test("Cursor projection carries its native guard event body", () => {
    expect(projectedRegistrations("cursor")).toEqual(expect.objectContaining({
      schemaVersion: 1, pluginName: "rin", harness: "cursor",
      registrations: expect.arrayContaining([{ kind: "event-body", path: ".cursor/hooks/plugin-hook-targets.json", event: "PreToolUse", hookFile: "guard-navigation.mjs" }]),
    }));
  });

  test("OpenCode projection carries its complete plugin dispatch row", () => {
    expect(projectedRegistrations("opencode")).toEqual(expect.objectContaining({
      schemaVersion: 1, pluginName: "rin", harness: "opencode",
      registrations: expect.arrayContaining([{ kind: "event-row", path: ".aidlc/hooks/plugin-hook-rows.json", row: {
        event: "PreToolUse", matcher: "Bash", target: "rin-guard-navigation", hookFile: "guard-navigation.mjs", capabilityId: "guard-navigation", pluginName: "rin",
      } }]),
    }));
  });

  test("selected Cursor composition installs the registered guard body and allows an ordinary shell operation", () => {
    const root = selectedCursorProject("selected-cursor");
    expect(JSON.parse(readFileSync(join(root, ".cursor", "hooks", "plugin-hook-targets.json"), "utf-8"))).toEqual(expect.objectContaining({ PreToolUse: expect.arrayContaining(["guard-navigation.mjs"]) }));
    expect(existsSync(join(root, ".cursor", "hooks", "guard-navigation.mjs"))).toBe(true);
    expect(cursorGuard(root)).toEqual({ permission: "allow" });
  }, 60_000);

  test("selected Cursor guard execution refuses a missing registered body", () => {
    const root = selectedCursorProject("missing-cursor-body");
    expect(JSON.parse(readFileSync(join(root, ".cursor", "hooks", "plugin-hook-targets.json"), "utf-8"))).toEqual(expect.objectContaining({ PreToolUse: expect.arrayContaining(["guard-navigation.mjs"]) }));
    rmSync(join(root, ".cursor", "hooks", "guard-navigation.mjs"), { force: true });
    expect(cursorGuard(root)).toEqual(expect.objectContaining({ permission: "deny" }));
  }, 60_000);

  test("an installed Rin board bridge reaches its guarded CLI refusal without maintainer dependencies", () => {
    const root = selectedCursorProject("portable-board-bridge");
    expect(existsSync(join(root, "node_modules"))).toBe(false);
    const result = spawnSync(process.execPath, ["--no-install", join(root, ".cursor", "tools", "rin-gates", "rin-gates-board-bridge-cli.ts")], {
      cwd: root,
      encoding: "utf-8",
      env: { ...process.env, NODE_PATH: "", AIDLC_PROJECT_DIR: root, AIDLC_HARNESS_DIR: ".cursor" },
      timeout: 30_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("rin-gates-board-bridge: --record-dir is required (a bare record name)");
  }, 60_000);
});

function configuredCursorProject({ name }: { readonly name: string }): string {
  const fixture = composePluginFixture({
    plugin: "rin", harness: "cursor", copyInstall: false, projectDir: join(scratch, name),
    env: hermeticGitEnvironment({ configHome: join(scratch, name, ".fixture-home") }),
    pluginBuilt: join(REPO_ROOT, "dist", "plugins", "rin", "cursor"),
    beforeCompose: ({ projectDir }) => {
      mkdirSync(join(projectDir, ".git"), { recursive: true });
      mkdirSync(join(projectDir, ".fixture-home"), { recursive: true });
      const configured = cursorConfiguration({ projectDir });
      expect(configured.status, configured.stdout + configured.stderr).toBe(0);
    },
  });
  return fixture.projectDir;
}

function cursorConfiguration({ projectDir, section = "root", arguments: extraArguments = [] }: {
  readonly projectDir: string;
  readonly arguments?: readonly string[];
  readonly section?: "root" | "project";
}) {
  const home = join(projectDir, ".fixture-home");
  return spawnSync(process.execPath, [
    join(REPO_ROOT, "core", "tools", "aidlc-init.ts"), ...{ root: ["config"], project: ["config", "project"] }[section],
    "--project-dir", projectDir, "--from", join(REPO_ROOT, "dist", "cursor"),
    "--harness", "cursor", "--yes", "--json", ...extraArguments,
  ], {
    cwd: projectDir, encoding: "utf8", timeout: NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
    env: { ...hermeticGitEnvironment({ configHome: home }),
      XDG_CONFIG_HOME: home, AIDLC_PROJECT_DIR: projectDir, AIDLC_HARNESS_DIR: ".cursor",
    },
  });
}

test("Cursor core refresh and explicit Rin selection retain verified plugin-owned projections", () => {
  const projectDir = configuredCursorProject({ name: "cursor-owned-refresh" });
  const refreshed = cursorConfiguration({ projectDir });
  expect(refreshed.status, refreshed.stdout + refreshed.stderr).toBe(0);
  const selected = cursorConfiguration({ projectDir, section: "project", arguments: ["--plugins", "aidlc,rin"] });
  expect(selected.status, selected.stdout + selected.stderr).toBe(0);
  const repeated = cursorConfiguration({ projectDir });
  expect(repeated.status, repeated.stdout + repeated.stderr).toBe(0);
  expect(JSON.parse(readFileSync(join(projectDir, ".cursor/hooks/plugin-hook-targets.json"), "utf8")))
    .toMatchObject({ PreToolUse: expect.arrayContaining(["guard-navigation.mjs"]) });
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

test("Cursor core refresh refuses unrelated edits to a plugin-composed hook registry", () => {
  const projectDir = configuredCursorProject({ name: "cursor-edited-registry-refresh" });
  const path = join(projectDir, ".cursor/hooks/plugin-hook-targets.json");
  const edited = `${JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), UserEvent: ["user-hook.ts"] }, null, 2)}\n`;
  writeFileSync(path, edited);
  const refreshed = cursorConfiguration({ projectDir, arguments: ["--dry-run"] });
  expect(refreshed.status).toBe(4);
  expect(refreshed.stdout).toContain(".cursor/hooks/plugin-hook-targets.json (locally modified or unowned)");
  expect(readFileSync(path, "utf8")).toBe(edited);
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

test("Cursor selection refuses prose edits outside the generated skill tables", () => {
  const projectDir = configuredCursorProject({ name: "cursor-edited-skill-refresh" });
  const path = join(projectDir, ".cursor/skills/aidlc/SKILL.md");
  const edited = `${readFileSync(path, "utf8")}\nUser-owned orchestration instruction.\n`;
  writeFileSync(path, edited);
  const selected = cursorConfiguration({ projectDir, section: "project", arguments: ["--plugins", "aidlc,rin", "--dry-run"] });
  expect(selected.status).toBe(4);
  expect(selected.stdout).toContain(".cursor/skills/aidlc/SKILL.md (locally modified or unowned)");
  expect(readFileSync(path, "utf8")).toBe(edited);
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

test("Cursor core refresh refuses an edited Rin-owned hook entry", () => {
  const projectDir = configuredCursorProject({ name: "cursor-edited-owned-hook-refresh" });
  const path = join(projectDir, ".cursor/hooks/plugin-hook-targets.json");
  const edited = readFileSync(path, "utf8").replace('"guard-navigation.mjs"', '"user-navigation.mjs"');
  writeFileSync(path, edited);
  const refreshed = cursorConfiguration({ projectDir, arguments: ["--dry-run"] });
  expect(refreshed.status).toBe(4);
  expect(JSON.parse(refreshed.stdout).message).toContain("plugin hook contribution conflict");
  expect(readFileSync(path, "utf8")).toBe(edited);
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
