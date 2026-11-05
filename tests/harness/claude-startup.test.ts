// Real installed startup and refusal controls for the bounded fixture host.
import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertStartupHookOutput, createClaudeStartupHost, type ClaudeStartupHost } from "./claude-startup.ts";
import { cleanupTestProject, REPO_ROOT } from "./fixtures.ts";
import { PRODUCTION_GUARD_OFF_SWITCHES } from "./runner-profile.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS, NATIVE_STARTUP_TIMEOUT_MS, remainingOperationTimeoutMs } from "./test-budget.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) cleanupTestProject(root); }, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
function installedHost(): ClaudeStartupHost {
  const root = mkdtempSync(join(tmpdir(), "guarded-startup-"));
  roots.push(root);
  const project = join(root, "project");
  const home = join(root, "home");
  const temporaryDirectory = join(root, "temp");
  for (const directory of [project, home, temporaryDirectory]) mkdirSync(directory);
  const host = createClaudeStartupHost(project, {
    ...process.env, HOME: home, USERPROFILE: home, AIDLC_HOME: join(home, ".aidlc"),
    AIDLC_CONFIG_HOME: join(home, "config"), XDG_CONFIG_HOME: join(home, ".config"),
    CLAUDE_CONFIG_DIR: join(home, ".claude"), CODEX_HOME: join(home, ".codex"),
    OPENCODE_CONFIG_DIR: join(home, ".opencode"), TEMP: temporaryDirectory, TMP: temporaryDirectory, TMPDIR: temporaryDirectory,
  });
  // A real surrounding checkout deliberately exercises nearest-Git ancestry.
  const outerRepository = spawnSync("git", ["init", "--quiet", "--template="], {
    cwd: root, env: host.env, encoding: "utf-8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
  });
  expect(outerRepository.status, outerRepository.stderr).toBe(0);
  const install = spawnSync(process.execPath, [join(REPO_ROOT, "dist/claude/.claude/tools/aidlc.ts"),
    "config", "--from", join(REPO_ROOT, "dist/claude"), "--harness", "claude", "--project-dir", project, "--yes", "--json"],
    { cwd: project, env: host.env, encoding: "utf-8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS) });
  expect(install.status, install.stderr || install.stdout).toBe(0);
  expect(host.env.AIDLC_TEST_GUARD_PROFILE).toBe("production");
  expect(PRODUCTION_GUARD_OFF_SWITCHES.map((key) => host.env[key])).toEqual(PRODUCTION_GUARD_OFF_SWITCHES.map(() => "0"));
  expect(host.env.AIDLC_UNATTENDED).toBeUndefined();
  return host;
}
function bare(host: ClaudeStartupHost, toolArguments: string[]) {
  return spawnSync(process.execPath, [join(host.project, ".claude/tools/aidlc.ts"), "engine", ...toolArguments],
    { cwd: host.project, env: host.env, encoding: "utf-8", timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS) });
}
function sourceRuntimeSnapshot(): Record<string, string> {
  const directory = join(REPO_ROOT, "aidlc");
  if (!existsSync(directory)) return {};
  const entries = (root: string): [string, string][] => readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? entries(path) : [[path, readFileSync(path, "base64")]];
  });
  return Object.fromEntries(entries(directory));
}
function recordSnapshot(project: string): Record<string, string> {
  const root = join(project, "aidlc", "spaces", "default", "intents");
  const snapshot: Record<string, string> = {};
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name === "aidlc-state.md" || path.split(/[\\/]/).includes("audit")) snapshot[path] = readFileSync(path, "base64");
    }
  };
  if (existsSync(root)) visit(root);
  return snapshot;
}

test("complete config install reaches its first stage through every registered startup and Bash hook", () => {
  const sourceBefore = sourceRuntimeSnapshot();
  const host = installedHost();
  expect(existsSync(join(host.project, ".git"))).toBe(true);
  expect(existsSync(join(dirname(host.project), ".git"))).toBe(true);
  expect(existsSync(join(dirname(host.project), "aidlc"))).toBe(false);
  host.start();
  host.prompt("/aidlc --scope enterprise fix the parser");
  const created = host.tool("aidlc.ts", ["engine", "intent", "create", "--scope", "enterprise", "--arguments", "fix the parser"]);
  expect(created.status, created.stderr || created.stdout).toBe(0);
  const binding = JSON.parse(readFileSync(join(host.project, "aidlc", ".aidlc-sessions", `${host.session}.binding.json`), "utf-8"));
  expect(binding.source).toBe("create");
  expect(typeof binding.intent).toBe("string");
  expect(binding.intent.length).toBeGreaterThan(0);
  expect(existsSync(join(host.project, "aidlc", "spaces", "default", "intents", binding.intent, "aidlc-state.md"))).toBe(true);
  const state = Object.entries(recordSnapshot(host.project)).find(([path]) => path.endsWith("aidlc-state.md"));
  expect(Buffer.from(state?.[1] ?? "", "base64").toString()).toContain("**Guard Policy**: strict");
  const next = host.next(["--scope", "enterprise"]);
  expect(next.directive.kind, next.result.stdout).toBe("run-stage");
  expect(next.directive.stage).toBe("intent-capture");
  expect(typeof next.directive.conductor_persona).toBe("string");
  expect(String(next.directive.conductor_persona).length).toBeGreaterThan(0);
  expect(host.calls.slice(0, 2).map((call) => call.event)).toEqual(["SessionStart", "UserPromptSubmit"]);
  expect(host.calls.filter((call) => call.kind === "hook").every((call) => call.status === 0)).toBe(true);
  const preHooks = host.calls.filter((call) => call.event === "PreToolUse").map((call) => call.command.split(" ").at(-1));
  expect([...new Set(preHooks)]).toEqual(["fold-usage", "state-transition-guard", "reviewer-scope", "review-freeze", "plan-approval-guard"]);
  expect(host.calls.some((call) => call.event === "PostToolUse" && call.command.endsWith("rebuild-stage-graph"))).toBe(true);
  expect(existsSync(join(host.project, "aidlc", "spaces", "default", "intents", binding.intent, ".aidlc-engine", "hooks-health", "plan-approval-guard.last"))).toBe(true);
  expect(existsSync(join(dirname(host.project), "aidlc"))).toBe(false);
  expect(sourceRuntimeSnapshot()).toEqual(sourceBefore);
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

test("the same installed profile without provider hooks still refuses next before stage work", () => {
  const host = installedHost();
  const created = bare(host, ["intent", "create", "--scope", "enterprise"]);
  expect(created.status, created.stderr || created.stdout).toBe(0);
  const before = recordSnapshot(host.project);
  const next = bare(host, ["orchestrate", "next", "--scope", "enterprise"]);
  expect(next.status, next.stderr).toBe(0);
  expect(JSON.parse(next.stdout)).toMatchObject({ kind: "print" });
  expect(JSON.parse(next.stdout).message).toContain("Claude Code is not running AI-DLC's hooks");
  expect(recordSnapshot(host.project)).toEqual(before);
  expect(host.calls).toEqual([]);
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

test("a real registered state guard blocks direct advancement before the tool runs", () => {
  const host = installedHost();
  host.start();
  host.prompt("/aidlc --scope enterprise fix the parser");
  expect(host.tool("aidlc.ts", ["engine", "intent", "create", "--scope", "enterprise"]).status).toBe(0);
  const before = recordSnapshot(host.project);
  const toolCount = host.calls.filter((call) => call.kind === "tool").length;
  expect(() => host.tool("aidlc.ts", ["engine", "state", "advance"])).toThrow("Installed state-transition-guard refused PreToolUse (2)");
  expect(host.calls.filter((call) => call.kind === "tool")).toHaveLength(toolCount);
  expect(recordSnapshot(host.project)).toEqual(before);
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

test("unsupported registered commands refuse before any hook executes", () => {
  const host = installedHost();
  const path = join(host.project, ".claude/settings.json");
  const settings = JSON.parse(readFileSync(path, "utf-8"));
  settings.hooks.SessionStart[0].hooks.push({ type: "command", command: "bun unknown.ts && echo unsafe" });
  writeFileSync(path, JSON.stringify(settings));
  expect(() => host.command("bun .claude/tools/aidlc.ts engine status && echo unsafe")).toThrow("Unsupported startup shell syntax");
  expect(() => host.start()).toThrow("Unsupported startup hook");
  expect(host.calls).toEqual([]);
}, NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

// These are fixture-adapter protocol controls, not forged workflow authority.
test.each([
  { label: "permission ask", output: { hookSpecificOutput: { permissionDecision: "ask" } } },
  { label: "permission deny", output: { hookSpecificOutput: { permissionDecision: "deny" } } },
  { label: "top-level ask", output: { decision: "ask" } },
  { label: "top-level block", output: { decision: "block" } },
  { label: "stop", output: { continue: false } },
  { label: "changed input", output: { hookSpecificOutput: { updatedInput: { command: "another command" } } } },
])("startup adapter refuses $label without a modeled approval or input-update route", ({ output }) => {
  const text = JSON.stringify(output);
  expect(() => assertStartupHookOutput(text)).toThrow();
});
