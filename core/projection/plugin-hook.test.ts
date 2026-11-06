import { expect, test } from "bun:test";
import { renderPluginHookContributions } from "./plugin-hook.ts";

const context = { pluginName: "sample", harnessDir: ".claude", invocation: "aidlc", trustedNamespace: "engine" };

test("Claude selects Node for a declared JavaScript body and keeps its matcher", () => {
  expect(renderPluginHookContributions({ ...context, harness: "claude", rows: [
    { pluginName: "sample", event: "PreToolUse", target: "guard-git", hookFile: "guard-git.mjs", matcher: "Bash" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "claude", registrations: [
    { kind: "group", path: ".claude/settings.json", event: "PreToolUse", group: { matcher: "Bash", hooks: [
      { type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-git.mjs"' },
    ] } },
  ] });
});

test("Claude selects Bun for TypeScript without manufacturing a matcher", () => {
  expect(renderPluginHookContributions({ ...context, harness: "claude", rows: [
    { pluginName: "sample", event: "SessionStart", target: "session-check", hookFile: "nested/session-check.ts" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "claude", registrations: [
    { kind: "group", path: ".claude/settings.json", event: "SessionStart", group: { hooks: [
      { type: "command", command: 'bun "$CLAUDE_PROJECT_DIR/.claude/hooks/nested/session-check.ts"' },
    ] } },
  ] });
});

test("compose registration remains owned by its existing bootstrap", () => {
  expect(renderPluginHookContributions({ ...context, harness: "claude", rows: [
    { pluginName: "sample", event: "SessionStart", target: "aidlc-plugin-compose", hookFile: "compose.ts" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "claude", registrations: [] });
});

test("a similarly named JavaScript hook is not mistaken for the compose bootstrap", () => {
  expect(renderPluginHookContributions({ ...context, harness: "claude", rows: [
    { pluginName: "sample", event: "SessionStart", target: "aidlc-plugin-compose-check", hookFile: "compose-check.js" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "claude", registrations: [
    { kind: "group", path: ".claude/settings.json", event: "SessionStart", group: { hooks: [
      { type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/compose-check.js"' },
    ] } },
  ] });
});

test("an undeclared hook set remains an explicit empty contribution", () => {
  expect(renderPluginHookContributions({ ...context, harness: "claude", rows: [] })).toEqual({
    schemaVersion: 1, pluginName: "sample", harness: "claude", registrations: [],
  });
});

test("Codex projects its adapter invocation and body target separately", () => {
  expect(renderPluginHookContributions({ ...context, harnessDir: ".codex", invocation: "aidlc.exe", harness: "codex", rows: [
    { pluginName: "sample", event: "PreToolUse", target: "guard-git", hookFile: "guard-git.ts", matcher: "Bash" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "codex", registrations: [
    { kind: "group", path: ".codex/hooks.json", event: "PreToolUse", group: { matcher: "Bash", hooks: [
      { type: "command", command: "aidlc.exe engine adapter codex guard-git" },
    ] } },
    { kind: "target", path: ".codex/hooks/plugin-hook-targets.json", target: "guard-git", hookFile: "guard-git.ts" },
  ] });
});

test("Copilot retains its native cross-shell group", () => {
  expect(renderPluginHookContributions({ ...context, harnessDir: ".github", harness: "copilot", rows: [
    { pluginName: "sample", event: "PreToolUse", target: "guard-git", hookFile: "guard-git.ts" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "copilot", registrations: [
    { kind: "group", path: ".github/hooks/aidlc.json", event: "PreToolUse", group: {
      type: "command", bash: "bun .github/hooks/aidlc-copilot-adapter.ts guard-git",
      powershell: "bun .github/hooks/aidlc-copilot-adapter.ts guard-git", timeoutSec: 30,
    } },
    { kind: "target", path: ".github/hooks/plugin-hook-targets.json", target: "guard-git", hookFile: "guard-git.ts" },
  ] });
});

test("Cursor retains an event-body contribution rather than a fabricated command", () => {
  expect(renderPluginHookContributions({ ...context, harnessDir: ".cursor", harness: "cursor", rows: [
    { pluginName: "sample", event: "PreToolUse", target: "guard-git", hookFile: "guard-git.ts" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "cursor", registrations: [
    { kind: "event-body", path: ".cursor/hooks/plugin-hook-targets.json", event: "PreToolUse", hookFile: "guard-git.ts" },
  ] });
});

test("OpenCode preserves the complete authored row", () => {
  expect(renderPluginHookContributions({ ...context, harnessDir: ".opencode", harness: "opencode", rows: [
    { pluginName: "sample", event: "PreToolUse", target: "guard-git", hookFile: "guard-git.ts", capabilityId: "git-guard" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "opencode", registrations: [
    { kind: "event-row", path: ".opencode/hooks/plugin-hook-rows.json", row: {
      pluginName: "sample", event: "PreToolUse", target: "guard-git", hookFile: "guard-git.ts", capabilityId: "git-guard",
    } },
  ] });
});

test("an existing unsupported Kiro contribution stays empty", () => {
  expect(renderPluginHookContributions({ ...context, harnessDir: ".kiro", harness: "kiro", rows: [
    { pluginName: "sample", event: "PreToolUse", target: "guard-git", hookFile: "guard-git.ts" },
  ] })).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "kiro", registrations: [] });
});

test("projection accepts deeply frozen authored input without mutating it", () => {
  const declaration = Object.freeze({ pluginName: "sample", event: "Stop", target: "session-check", hookFile: "session-check.ts" });
  const request = Object.freeze({ ...context, harness: "claude", rows: Object.freeze([declaration]) });
  expect(renderPluginHookContributions(request)).toEqual({ schemaVersion: 1, pluginName: "sample", harness: "claude", registrations: [
    { kind: "group", path: ".claude/settings.json", event: "Stop", group: { hooks: [
      { type: "command", command: 'bun "$CLAUDE_PROJECT_DIR/.claude/hooks/session-check.ts"' },
    ] } },
  ] });
  expect(request).toEqual({ pluginName: "sample", harnessDir: ".claude", invocation: "aidlc", trustedNamespace: "engine", harness: "claude", rows: [
    { pluginName: "sample", event: "Stop", target: "session-check", hookFile: "session-check.ts" },
  ] });
});
