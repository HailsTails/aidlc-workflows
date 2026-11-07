import { expect, test } from "vitest";

const triggerThrow = (): never => {
  throw new Error("manual throw");
};

test("uses banned `throw` instead of vitest matchers", () => {
  expect(triggerThrow).toThrow();
});
