import { expect, it } from "vitest";
import { createSystemClock } from "./clock.ts";

it("reads a numeric time", () => {
  expect(createSystemClock().now()).toBeTypeOf("number");
});
