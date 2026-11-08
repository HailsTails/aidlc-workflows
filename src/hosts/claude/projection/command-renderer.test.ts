import { expect, test } from "bun:test";
import { claudeCommandPath } from "./command-renderer.ts";

test("Claude commands belong under its native skills directory", () => {
  expect(claudeCommandPath({ nativeName: "aidlc-example", within: "agents/guard.yaml",
    content: { kind: "text", text: "Companion" }, mode: "regular" }))
    .toBe(".claude/skills/aidlc-example/agents/guard.yaml");
});
