import { expect, test } from "bun:test";
import { knowledgeReadingGuides, shippedFormatDocuments, delegatedSharedKnowledge } from "./legacy-format-docs.ts";

test("the frozen format roster supplies the shared knowledge exclusions", () => {
  expect([...shippedFormatDocuments()]).toEqual([
    "audit-format.md", "knowledge-readme-template.md", "memory-template.md",
    "state-template.md", "worktree-info-schema.md",
  ]);
});
test("delegated preflight reads its exact shared-knowledge exclusions from the frozen owner", () => {
  expect(delegatedSharedKnowledge(".claude")).toBe("`.claude/knowledge/aidlc-shared/` (all but its format references `audit-format.md`, `knowledge-readme-template.md`, `memory-template.md`, `state-template.md` and `worktree-info-schema.md`: a step that needs one names it)");
});
test("the in-parts reading guide is the shipped runtime's own Kiro preflight clause", () => {
  expect(knowledgeReadingGuides(".kiro")).toEqual({
    ["whole-files"]: "",
    ["in-parts"]: "To find them, list each of these folders with your file tool, one folder per call, and any "
      + "folder inside one the same way; a folder that is not there has nothing to load, and a shell line that "
      + "lists, searches or reads them can stop and ask the person to approve it. Kiro shows only part of a long "
      + "file: read each one with your file tool in parts of at most 200 lines (offset and limit), from the "
      + "first line to the last; a read that comes back cut short is not all of it. ",
  });
});
