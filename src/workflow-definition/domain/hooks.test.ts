import { describe, expect, test } from "bun:test";
import { HOOK_POINTS, LIFECYCLE_HOOK_POINTS, TOOL_HOOK_POINTS, TOOL_TARGETS } from "./hooks.ts";

describe("hook vocabulary", () => {
  test("TOOL_HOOK_POINTS lists the points around a tool call", () => {
    expect(TOOL_HOOK_POINTS).toEqual(["before-tool", "after-tool"]);
  });

  test("LIFECYCLE_HOOK_POINTS lists the points in a session's life", () => {
    expect(LIFECYCLE_HOOK_POINTS).toEqual([
      "session-start",
      "session-end",
      "user-prompt",
      "subagent-start",
      "subagent-stop",
      "before-compaction",
      "stop",
      "status-line",
    ]);
  });

  test("HOOK_POINTS lists the lifecycle points followed by the tool points", () => {
    expect(HOOK_POINTS).toEqual([
      "session-start",
      "session-end",
      "user-prompt",
      "subagent-start",
      "subagent-stop",
      "before-compaction",
      "stop",
      "status-line",
      "before-tool",
      "after-tool",
    ]);
  });

  test("TOOL_TARGETS lists the host-neutral tool targets, in matcher order", () => {
    expect(TOOL_TARGETS).toEqual([
      "file-read",
      "file-write",
      "file-search",
      "shell",
      "subagent-dispatch",
      "task-list-update",
      "human-question",
    ]);
  });
});
