import { expect, test } from "bun:test";
import { assertDefined } from "./defined.ts";

test("missing fixture output fails through an assertion", () => {
  expect(() => assertDefined(undefined)).toThrow();
});

test("a zero fixture value remains defined", () => {
  const zeroFixture = 0;
  assertDefined(zeroFixture);
  expect(zeroFixture).toBe(0);
});

test("a deliberate null fixture value remains defined", () => {
  const nullFixture = null;
  assertDefined(nullFixture);
  expect(nullFixture).toBeNull();
});
