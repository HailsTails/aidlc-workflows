import { describe, expect, it } from "vitest";
import type { Equal } from "../../../core/values/type-equality.ts";
import type { WalkerCheck } from "./walker-check.ts";
import {
  isWalkerCheckKeySetEqual,
  type LoadedWalkerCheck,
  walkerCheckModuleSchema,
  walkerPieceSettingsSchema,
} from "./walker-check-schema.ts";

type AnyWalkerCheck = WalkerCheck<unknown, unknown, unknown>;

const syntaxVariantKeysMatch: Equal<
  keyof Extract<AnyWalkerCheck, { readonly kind: "syntax" }>,
  keyof Extract<LoadedWalkerCheck, { readonly kind: "syntax" }>
> = true;

const pathVariantKeysMatch: Equal<
  keyof Extract<AnyWalkerCheck, { readonly kind: "path" }>,
  keyof Extract<LoadedWalkerCheck, { readonly kind: "path" }>
> = true;

const inspectNothing = () => [];

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
    "checks/../../x.ts",
    "./x.ts",
    "/abs/x.ts",
    "C:/x.ts",
    "checks\\x.ts",
    "checks//x.ts",
    "x.js",
    "x.d.ts.map",
    "x",
    "",
  ])("refuses the module %j", (module) => {
    expect(walkerPieceSettingsSchema.safeParse({ module }).success).toBe(false);
  });

  it("refuses settings with no module", () => {
    expect(walkerPieceSettingsSchema.safeParse({}).success).toBe(false);
  });

  it("refuses a module that is not text", () => {
    expect(walkerPieceSettingsSchema.safeParse({ module: 1 }).success).toBe(false);
  });

  it("refuses settings that are not an object", () => {
    expect(walkerPieceSettingsSchema.safeParse("class-syntax.ts").success).toBe(false);
  });
});

describe("walkerCheckModuleSchema", () => {
  it("accepts a syntax check whose inspect is a function", () => {
    expect(
      walkerCheckModuleSchema.safeParse({ kind: "syntax", inspect: inspectNothing }),
    ).toMatchObject({ success: true, data: { kind: "syntax" } });
  });

  it("accepts a path check whose inspect is a function", () => {
    expect(
      walkerCheckModuleSchema.safeParse({ kind: "path", inspect: inspectNothing }),
    ).toMatchObject({ success: true, data: { kind: "path" } });
  });

  it("refuses a check of an unknown kind", () => {
    expect(
      walkerCheckModuleSchema.safeParse({ kind: "tree", inspect: inspectNothing }).success,
    ).toBe(false);
  });

  it("refuses a check with no kind", () => {
    expect(walkerCheckModuleSchema.safeParse({ inspect: inspectNothing }).success).toBe(false);
  });

  it("refuses a check with no inspect", () => {
    expect(walkerCheckModuleSchema.safeParse({ kind: "syntax" }).success).toBe(false);
  });

  it("refuses a check whose inspect is not a function", () => {
    expect(walkerCheckModuleSchema.safeParse({ kind: "path", inspect: "inspect" }).success).toBe(
      false,
    );
  });

  it("refuses an absent check export", () => {
    expect(walkerCheckModuleSchema.safeParse(undefined).success).toBe(false);
  });

  it("holds the same keys as the generic walker check", () => {
    expect(isWalkerCheckKeySetEqual).toBe(true);
  });

  it("holds the same keys as the generic walker check's syntax variant", () => {
    expect(syntaxVariantKeysMatch).toBe(true);
  });

  it("holds the same keys as the generic walker check's path variant", () => {
    expect(pathVariantKeysMatch).toBe(true);
  });
});
