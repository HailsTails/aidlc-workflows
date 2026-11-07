import { describe, expect, it } from "vitest";
import { walkerPieceSettingsSchema } from "./walker-check-schema.ts";

describe("walkerPieceSettingsSchema", () => {
  it.each([
    "class-syntax.ts",
    "checks/no-tmp-files.ts",
  ])("accepts the module %j, a path inside the piece folder ending .ts", (module) => {
    expect(walkerPieceSettingsSchema.safeParse({ module })).toEqual({
      success: true,
      data: { module },
    });
  });

  it.each([
    "../x.ts",
    "x.js",
  ])("refuses the module %j", (module) => {
    expect(walkerPieceSettingsSchema.safeParse({ module }).success).toBe(false);
  });
});
