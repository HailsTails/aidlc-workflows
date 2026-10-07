import { describe, expect, test } from "bun:test";
import {
  CODEX_DISPATCH_MATCHER,
  normalizeCodexDispatchTool,
} from "./aidlc-codex-dispatch-tool.ts";

describe("native Codex dispatch tool names", () => {
  test.each([
    { eventName: "PreToolUse", toolName: "spawn_agent", expectedName: "spawn_agent" },
    { eventName: "PreToolUse", toolName: "collaboration.spawn_agent", expectedName: "spawn_agent" },
    { eventName: "PreToolUse", toolName: "collaboration.wait_agent", expectedName: "collaboration.wait_agent" },
    { eventName: "PreToolUse", toolName: "other.spawn_agent", expectedName: "other.spawn_agent" },
    { eventName: "PreToolUse", toolName: "collaborationXspawn_agent", expectedName: "collaborationXspawn_agent" },
    { eventName: "PostToolUse", toolName: "collaboration.spawn_agent", expectedName: "collaboration.spawn_agent" },
    { eventName: "SubagentStop", toolName: "collaboration.spawn_agent", expectedName: "collaboration.spawn_agent" },
    { eventName: undefined, toolName: "collaboration.spawn_agent", expectedName: "collaboration.spawn_agent" },
    { eventName: "PreToolUse", toolName: undefined, expectedName: undefined },
  ])("$eventName / $toolName resolves to $expectedName", ({ eventName, toolName, expectedName }) => {
    expect(normalizeCodexDispatchTool({ eventName, toolName })).toBe(expectedName);
  });

  test.each([
    { toolName: "spawn_agent", expectedMatch: true },
    { toolName: "collaboration.spawn_agent", expectedMatch: true },
    { toolName: "collaboration.wait_agent", expectedMatch: false },
    { toolName: "other.spawn_agent", expectedMatch: false },
    { toolName: "collaborationXspawn_agent", expectedMatch: false },
    { toolName: "prefix.spawn_agent", expectedMatch: false },
    { toolName: "spawn_agent_suffix", expectedMatch: false },
  ])("generated matcher for $toolName is $expectedMatch", ({ toolName, expectedMatch }) => {
    expect(new RegExp(CODEX_DISPATCH_MATCHER).test(toolName)).toBe(expectedMatch);
  });
});
