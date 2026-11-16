import { expect, test } from "bun:test";
import { kiroKnowledgePreflightClause } from "../../../core/tools/aidlc-inline-context.ts";
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
    ["in-parts"]: kiroKnowledgePreflightClause(".kiro"),
  });
  expect(knowledgeReadingGuides(".kiro")["in-parts"]).toStartWith(
    "To find them, list each of these folders with your file tool, one folder per call");
});
