import { expect, test } from "bun:test";
import { GENERATED_SKILL_REGIONS, replaceGeneratedSkillRegion } from "./generated-skill-regions.ts";

test("generated references retain stage-before-scope rendering order and invocation-independent prefixes", () => {
  expect(GENERATED_SKILL_REGIONS).toEqual([
    { verb: "stage-table", begin: "<!-- BEGIN: compiled stage graph via ", end: "<!-- END: compiled stage graph -->" },
    { verb: "scope-table", begin: "<!-- BEGIN: compiled scope grid via ", end: "<!-- END: compiled scope grid -->" },
  ]);
});

test("replaces the complete stage region while preserving surrounding prose and line endings", () => {
  expect(replaceGeneratedSkillRegion({ text: "Before\r\n<!-- BEGIN: compiled stage graph via `old command` -->\nstale\n<!-- END: compiled stage graph -->\r\nAfter\n", rendered: "<!-- BEGIN: compiled stage graph via `new command` -->\nfresh\n<!-- END: compiled stage graph -->", region: GENERATED_SKILL_REGIONS[0], path: "tables.md" })).toEqual({ status: "ok", text: "Before\r\n<!-- BEGIN: compiled stage graph via `new command` -->\nfresh\n<!-- END: compiled stage graph -->\r\nAfter\n" });
});

test("replaces the complete scope region without interpreting its generated contents", () => {
  expect(replaceGeneratedSkillRegion({ text: "<!-- BEGIN: compiled scope grid via `bun .claude/tools/aidlc.ts engine gen scope-table` -->\nstale\n<!-- END: compiled scope grid -->", rendered: "<!-- BEGIN: compiled scope grid via `aidlc gen scope-table` -->\n| fresh |\n<!-- END: compiled scope grid -->", region: GENERATED_SKILL_REGIONS[1], path: "tables.md" })).toEqual({ status: "ok", text: "<!-- BEGIN: compiled scope grid via `aidlc gen scope-table` -->\n| fresh |\n<!-- END: compiled scope grid -->" });
});

test("an absent region leaves the document unchanged", () => {
  expect(replaceGeneratedSkillRegion({ text: "Authored guide\n", rendered: "unused", region: GENERATED_SKILL_REGIONS[0], path: "tables.md" })).toEqual({ status: "ok", text: "Authored guide\n" });
});

test("the other table's marker pair is not mistaken for the selected region", () => {
  expect(replaceGeneratedSkillRegion({ text: "<!-- BEGIN: compiled scope grid via another command -->\nkept\n<!-- END: compiled scope grid -->", rendered: "unused", region: GENERATED_SKILL_REGIONS[0], path: "tables.md" })).toEqual({ status: "ok", text: "<!-- BEGIN: compiled scope grid via another command -->\nkept\n<!-- END: compiled scope grid -->" });
});

test("similar prose that is not an exact marker prefix remains unchanged", () => {
  expect(replaceGeneratedSkillRegion({ text: "BEGIN: compiled stage graph via example\n<!-- END: compiled stage graphs -->", rendered: "unused", region: GENERATED_SKILL_REGIONS[0], path: "tables.md" })).toEqual({ status: "ok", text: "BEGIN: compiled stage graph via example\n<!-- END: compiled stage graphs -->" });
});

test.each([
  { text: "<!-- BEGIN: compiled stage graph via command -->\nmissing end" },
  { text: "missing begin\n<!-- END: compiled stage graph -->" },
  { text: "<!-- END: compiled stage graph -->\n<!-- BEGIN: compiled stage graph via command -->" },
  { text: "<!-- BEGIN: compiled stage graph via first -->\n<!-- BEGIN: compiled stage graph via second -->\n<!-- END: compiled stage graph -->" },
  { text: "<!-- BEGIN: compiled stage graph via command -->\n<!-- END: compiled stage graph -->\n<!-- END: compiled stage graph -->" },
])("incomplete, reversed or repeated stage markers refuse without partial text", ({ text }) => {
  expect(replaceGeneratedSkillRegion({ text, rendered: "fresh", region: GENERATED_SKILL_REGIONS[0], path: "nested/tables.md" })).toEqual({ status: "refused", detail: "packager: malformed stage-table markers in nested/tables.md" });
});

test("changing a command suffix cannot hide a second begin marker", () => {
  expect(replaceGeneratedSkillRegion({ text: "<!-- BEGIN: compiled scope grid via `bun .claude/tools/aidlc.ts engine gen scope-table` -->\n<!-- END: compiled scope grid -->\n<!-- BEGIN: compiled scope grid via `aidlc gen scope-table` -->", rendered: "fresh", region: GENERATED_SKILL_REGIONS[1], path: "tables.md" })).toEqual({ status: "refused", detail: "packager: malformed scope-table markers in tables.md" });
});

test("marker recognition retains the native text grammar inside fenced prose", () => {
  expect(replaceGeneratedSkillRegion({ text: "```text\n<!-- BEGIN: compiled stage graph via example -->\nold\n<!-- END: compiled stage graph -->\n```", rendered: "fresh", region: GENERATED_SKILL_REGIONS[0], path: "tables.md" })).toEqual({ status: "ok", text: "```text\nfresh\n```" });
});
