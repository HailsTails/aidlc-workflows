import { expect, test } from "bun:test";
import { renderWorkflowProse } from "../../../../../scripts/projection/src/domain/workflow-prose.ts";
import { renderAuthoredProse } from "../../../../../scripts/projection/src/domain/authored-prose.ts";
test("workflow prose exposes the canonical authored-prose transformation", () => {
  expect(renderWorkflowProse).toBe(renderAuthoredProse);
});
