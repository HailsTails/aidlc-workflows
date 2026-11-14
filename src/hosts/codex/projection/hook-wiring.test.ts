import { expect, test } from "bun:test";
import { HOOK_WIRING } from "./hook-wiring.ts";

test("Codex registers the retained core consumers in their shipped order", () => {
  expect(HOOK_WIRING).toEqual([
    { event: "SessionStart", target: "session-start" },
    { event: "UserPromptSubmit", target: "record-human-turn" },
    { event: "PreToolUse", target: "guard-tool-call" },
    { event: "PreToolUse", matcher: "spawn_agent", target: "deliver-stage-rules" },
    { event: "PostToolUse", matcher: "request_user_input", target: "record-human-turn" },
    { event: "PostToolUse", matcher: "apply_patch", target: "audit-and-sensors" },
    { event: "PostToolUse", matcher: "update_plan", target: "sync-workflow-state" },
    { event: "PostToolUse", matcher: "Bash", target: "rebuild-stage-graph" },
    { event: "PreCompact", target: "validate-state" },
    { event: "SubagentStop", target: "log-subagent" },
    { event: "Stop", target: "continue-workflow" },
  ]);
});
