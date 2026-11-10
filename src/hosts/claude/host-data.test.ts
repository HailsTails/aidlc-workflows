import { expect, test } from "bun:test";
import { CLAUDE_BINDING_HEADING, CLAUDE_HOST_DATA, CLAUDE_TOKENS, CLAUDE_AUTHORED_PLACEMENTS } from "./host-data.ts";

test("Claude declares its native invocation and four-option question surface", () => {
  expect(CLAUDE_BINDING_HEADING).toBe("Claude Code");
  expect(CLAUDE_TOKENS).toEqual({ ["SKILL_INVOKE"]: null, ["OPTION_LETTERS"]: "A-D" });
  expect(CLAUDE_HOST_DATA.newChatStep).toEqual({ text: "type /clear, then <entry>" });
  expect(CLAUDE_HOST_DATA.hostShell).toEqual({ env: ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID"] });
});

test("Claude owns exact placements for its remaining non-settings authored files", () => {
  expect(CLAUDE_AUTHORED_PLACEMENTS).toEqual([
    { source: "settings.local.json.example", destination: ".claude/settings.local.json.example" },
    { source: ".mcp.json", destination: ".mcp.json" },
    { source: "dot-gitignore", destination: ".gitignore" },
    { source: "rules-aidlc.md", destination: ".claude/rules/aidlc.md" },
  ]);
});