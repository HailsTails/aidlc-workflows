import { describe, expect, it } from "vitest";
import { pieceTypePackagesSchema } from "./piece-type-packages-schema.ts";

describe("pieceTypePackagesSchema", () => {
  it("accepts a list of package names", () => {
    expect(pieceTypePackagesSchema.safeParse(["typescript", "@types/node"])).toEqual({
      success: true,
      data: ["typescript", "@types/node"],
    });
  });

  it("refuses an empty list", () => {
    expect(pieceTypePackagesSchema.safeParse([]).success).toBe(false);
  });

  it("refuses a list holding a non-string", () => {
    expect(pieceTypePackagesSchema.safeParse(["typescript", 1]).success).toBe(false);
  });

  it("refuses a bare package name that is not in a list", () => {
    expect(pieceTypePackagesSchema.safeParse("typescript").success).toBe(false);
  });
});
