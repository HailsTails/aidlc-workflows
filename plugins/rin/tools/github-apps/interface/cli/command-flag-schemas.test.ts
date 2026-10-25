import { describe, expect, it } from "vitest";
import { bodyFlags, pullNumberFlag, sessionFlag } from "./command-flag-schemas.ts";

describe("pullNumberFlag", () => {
  it("reads a pull request number", () => {
    expect(pullNumberFlag.parse("42")).toBe(42);
  });

  it("refuses something that is not a positive number", () => {
    expect(pullNumberFlag.safeParse("#42").success).toBe(false);
  });
});

describe("sessionFlag", () => {
  it("accepts a branch-shaped session id", () => {
    expect(sessionFlag.parse("feature/basket-2")).toBe("feature/basket-2");
  });

  it("refuses text that could close the provenance comment early", () => {
    expect(sessionFlag.safeParse("x --> injected").success).toBe(false);
  });
});

describe("bodyFlags", () => {
  it("leaves both body sources optional", () => {
    expect(bodyFlags["body-file"].parse(undefined)).toBeUndefined();
  });
});
