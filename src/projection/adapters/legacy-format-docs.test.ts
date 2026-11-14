import { expect, test } from "bun:test";
import { shippedFormatDocuments, delegatedSharedKnowledge } from "./legacy-format-docs.ts";

test("the frozen format roster supplies the shared knowledge exclusions", () => {
  expect([...shippedFormatDocuments()]).toEqual([
    "audit-format.md", "knowledge-readme-template.md", "memory-template.md",
    "state-template.md", "worktree-info-schema.md",
  ]);
});
test("delegated preflight reads its exact shared-knowledge exclusions from the frozen owner", () => {
  expect(delegatedSharedKnowledge(".claude")).toBe("`.claude/knowledge/aidlc-shared/` (all but its format references `audit-format.md`, `knowledge-readme-template.md`, `memory-template.md`, `state-template.md` and `worktree-info-schema.md`: a step that needs one names it)");
});
