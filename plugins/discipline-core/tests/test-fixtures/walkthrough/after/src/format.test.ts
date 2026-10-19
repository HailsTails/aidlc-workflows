import { expect, it } from "vitest";
import { formatPence } from "./format.ts";

it("formats pence as pounds", () => {
  expect(formatPence({ pence: 250 })).toBe("£2.50");
});
