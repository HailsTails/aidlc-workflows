import { describe, expect, it } from "vitest";
import { walkerPieceSettingsSchema } from "./walker-check-schema.ts";

describe("walkerPieceSettingsSchema", () => {
  it.each([
    "class-syntax.ts",
    "checks/no-tmp-files.ts",
    "class-syntax.js",
  ])("accepts the module %j, a path inside the piece folder ending .ts, or .js as a built install ships it", (module) => {
    expect(walkerPieceSettingsSchema.safeParse({ module })).toEqual({
      success: true,
      data: { module },
    });
  });

  it.each([
    "../x.ts",
    "../x.js",
    "x.mjs",
    "x",
  ])("refuses the module %j", (module) => {
    expect(walkerPieceSettingsSchema.safeParse({ module }).success).toBe(false);
  });
});
