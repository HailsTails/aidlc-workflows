import { expect, it } from "vitest";
import { plain } from "./plain.ts";

it("holds three", () => {
  expect(plain).toBe(3);
});
