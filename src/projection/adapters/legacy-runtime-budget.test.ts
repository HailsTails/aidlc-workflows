import { expect, test } from "bun:test";
import { extendedSubprocessTimeoutMs } from "./legacy-runtime-budget.ts";

test("settings consumers retain the shipped extended subprocess ceiling", () => {
  expect(extendedSubprocessTimeoutMs()).toBe(1_800_000);
});
