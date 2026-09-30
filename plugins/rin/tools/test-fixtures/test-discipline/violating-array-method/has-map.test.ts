import { expect, test } from "vitest";

test("uses banned .map array method to derive assertion input", () => {
  const inputs = [1, 2, 3];
  const doubled = inputs.map((entry) => entry * 2);
  expect(doubled).toEqual([2, 4, 6]);
});
