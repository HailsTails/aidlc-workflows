import { expect, test } from "vitest";

test("uses banned `if` branch in test body", () => {
  const flag = true;
  if (flag) {
    expect(flag).toBe(true);
  }
});
