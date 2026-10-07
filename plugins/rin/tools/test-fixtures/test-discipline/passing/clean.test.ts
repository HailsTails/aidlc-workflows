import { expect, test } from "vitest";

test("clean fixture exercises only hardcoded matchers", () => {
  const reportResult = { kind: "ok", numberValue: 42 };
  expect(reportResult).toEqual({ kind: "ok", numberValue: 42 });
});
