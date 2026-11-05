import { expect, test } from "bun:test";
import { createWorkflowSourceInventory } from "./workflow-source-inventory.ts";
test("production authored inventory exposes the native-walker storage port", () => {
  expect(createWorkflowSourceInventory()).toMatchObject({ read: expect.any(Function) });
});
