import { expect, test } from "bun:test";
import { renameRulesFolder } from "./rules-folder.ts";

test("a host with no rules rename keeps authored references", () => {
  expect(renameRulesFolder({ text: "Read .claude/rules/org.md", harnessDir: ".claude", rulesFolder: null }))
    .toBe("Read .claude/rules/org.md");
});

test("only this host's Markdown rules change and native default.rules stays", () => {
  expect(renameRulesFolder({ text: ".codex/rules/org.md .codex/rules/default.rules other/rules/team.md",
    harnessDir: ".codex", rulesFolder: "aidlc-rules" }))
    .toBe(".codex/aidlc-rules/org.md .codex/rules/default.rules other/rules/team.md");
});

test("directory punctuation is literal rather than another pattern", () => {
  expect(renameRulesFolder({ text: ".host[1]+/rules/org.md .host1/rules/org.md",
    harnessDir: ".host[1]+", rulesFolder: "steering" }))
    .toBe(".host[1]+/steering/org.md .host1/rules/org.md");
});
