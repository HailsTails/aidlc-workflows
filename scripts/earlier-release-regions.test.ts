import { expect, test } from "bun:test";
import { earlierReleasesReadSkill, prepareEarlierReleaseSkillText } from "./earlier-release-regions.ts";

test.each([
  { skillRel: ".claude/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: true },
  { skillRel: ".claude\\skills\\aidlc\\SKILL.md", harnessDir: ".claude", expected: true },
  { skillRel: ".agents/skills/aidlc/SKILL.md", harnessDir: ".codex", expected: true },
  { skillRel: ".kiro/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: false },
  { skillRel: ".claude/skills/other/SKILL.md", harnessDir: ".claude", expected: false },
])("retains earlier-release skill selection for $skillRel on $harnessDir", ({ skillRel, harnessDir, expected }) => {
  expect(earlierReleasesReadSkill(skillRel, harnessDir)).toBe(expected);
});

test.each([
  { label: "no final newline", text: "body", skillRel: ".claude/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: "body\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n" },
  { label: "empty", text: "", skillRel: ".claude/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: "\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n" },
  { label: "multiple final LF", text: "body\n\n\n", skillRel: ".claude/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: "body\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n" },
  { label: "CRLF retains CR", text: "body\r\n", skillRel: ".claude/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: "body\r\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n" },
  { label: "other skill", text: "body\n\n", skillRel: ".claude/skills/other/SKILL.md", harnessDir: ".claude", expected: "body\n\n" },
  { label: "cross harness", text: "body\n\n", skillRel: ".kiro/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: "body\n\n" },
  { label: "shared agents skill", text: "body\n", skillRel: ".agents/skills/aidlc/SKILL.md", harnessDir: ".codex", expected: "body\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n" },
  { label: "existing footer appends again", text: "body\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n", skillRel: ".claude/skills/aidlc/SKILL.md", harnessDir: ".claude", expected: "body\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n" },
])("prepares exact Native earlier-release footer text: $label", ({ text, skillRel, harnessDir, expected }) => {
  expect(prepareEarlierReleaseSkillText({ text, skillRel, harnessDir })).toBe(expected);
});
