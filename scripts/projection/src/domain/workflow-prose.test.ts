import { expect, test } from "bun:test";
import { renderWorkflowProse } from "./workflow-prose.ts";
import { renderAuthoredProse } from "./authored-prose.ts";
test("workflow prose exposes the canonical authored-prose transformation", () => {
  expect(renderWorkflowProse).toBe(renderAuthoredProse);
});
