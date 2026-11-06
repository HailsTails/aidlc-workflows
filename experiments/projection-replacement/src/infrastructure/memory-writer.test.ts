import { expect, test } from "bun:test";
import { createMemoryWriter } from "./memory-writer.ts";
import { memoryPlanFixture } from "../../__tests__/installation-fixtures.ts";
test("structural plans are refused without changing writer state", () => {
  const writer = createMemoryWriter({
    initial: [{ kind: "file", path: "personal.md", body: "Personal", ownership: null }],
  });
  expect(Reflect.apply(writer.apply, undefined, [memoryPlanFixture()])).toEqual({
    status: "blocked",
    reason: "unvalidated-plan",
  });
  expect(writer.snapshot()).toEqual({
    revision: 0,
    resources: [{ kind: "file", path: "personal.md", body: "Personal", ownership: null }],
  });
});
