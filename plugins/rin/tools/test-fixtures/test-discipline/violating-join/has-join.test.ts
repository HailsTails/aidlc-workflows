import { expect, test } from "vitest";

test("uses banned .join dynamic operation to build assertion input", () => {
  const parts = ["a", "b", "c"];
  const joined = parts.join(",");
  expect(joined).toEqual("a,b,c");
});
