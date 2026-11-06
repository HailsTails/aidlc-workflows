import { expect, test } from "bun:test";
import { createAuthoredSourceInventory } from "./authored-source-inventory.ts";
test("production authored inventory exposes the native-walker storage port", () => {
  expect(createAuthoredSourceInventory()).toMatchObject({ read: expect.any(Function), conductor: expect.any(Function) });
});
