import { expect, test } from "vitest";
import { stampNow } from "./reads-wall-clock.js";

test("stampNow returns a number", () => {
  expect(typeof stampNow()).toBe("number");
});
