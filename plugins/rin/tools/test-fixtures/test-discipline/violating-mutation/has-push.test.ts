import { expect, test } from "vitest";

test("uses banned .push mutation to accumulate assertion input", () => {
  const collected: number[] = [];
  collected.push(1);
  expect(collected).toEqual([1]);
});
