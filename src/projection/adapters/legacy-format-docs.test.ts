import { expect, test } from "bun:test";
import { shippedFormatDocuments } from "./legacy-format-docs.ts";

test("the frozen format roster supplies the shared knowledge exclusions", () => {
  expect([...shippedFormatDocuments()]).toEqual([
    "audit-format.md", "knowledge-readme-template.md", "memory-template.md",
    "state-template.md", "worktree-info-schema.md",
  ]);
});