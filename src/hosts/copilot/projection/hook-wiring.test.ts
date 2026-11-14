import { expect, test } from "bun:test";
import { HOOK_WIRING } from "./hook-wiring.ts";

test("Copilot wires only its eight supported event consumers with two compound budgets", () => {
  expect(HOOK_WIRING).toEqual([
    { event: "SessionStart", target: "session-start", timeoutMultiplier: 1 },
    { event: "UserPromptSubmit", target: "record-human-turn", timeoutMultiplier: 1 },
    { event: "PreToolUse", target: "guard-tool-call", timeoutMultiplier: 1 },
    { event: "PostToolUse", target: "post-tool", timeoutMultiplier: 2 },
    { event: "PreCompact", target: "validate-state", timeoutMultiplier: 1 },
    { event: "SubagentStart", target: "subagent-start", timeoutMultiplier: 1 },
    { event: "SubagentStop", target: "log-subagent", timeoutMultiplier: 1 },
    { event: "Stop", target: "continue-workflow", timeoutMultiplier: 2 },
  ]);
});
