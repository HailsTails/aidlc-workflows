import { describe, expect, it } from "vitest";
import { sessionFlag } from "./command-flag-schemas.ts";

describe("sessionFlag", () => {
  it("accepts a branch-shaped session id", () => {
    expect(sessionFlag.parse("feature/basket-2")).toBe("feature/basket-2");
  });

  it("refuses text that could close the provenance comment early", () => {
    expect(sessionFlag.safeParse("x --> injected").success).toBe(false);
  });
});
