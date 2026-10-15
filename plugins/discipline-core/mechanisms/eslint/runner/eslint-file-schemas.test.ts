import { describe, expect, it } from "vitest";
import { packageJsonSchema, suppressionsFileSchema } from "./eslint-file-schemas.ts";

describe("packageJsonSchema", () => {
  it("accepts a package.json whose scripts map names to strings, keeping its other fields", () => {
    expect(
      packageJsonSchema.safeParse({ name: "app", scripts: { lint: "eslint .", test: "vitest" } }),
    ).toEqual({
      success: true,
      data: { name: "app", scripts: { lint: "eslint .", test: "vitest" } },
    });
  });

  it("accepts a package.json with no scripts", () => {
    expect(packageJsonSchema.safeParse({ name: "app" })).toEqual({
      success: true,
      data: { name: "app" },
    });
  });

  it.each([
    { scripts: { lint: 3 } },
    { scripts: ["eslint ."] },
    { scripts: "eslint ." },
  ])("refuses %j, whose scripts are not a map of strings", (packageJson) => {
    expect(packageJsonSchema.safeParse(packageJson)).toMatchObject({ success: false });
  });

  it.each([null, "package", ["eslint ."]])("refuses %j, which is not an object", (packageJson) => {
    expect(packageJsonSchema.safeParse(packageJson)).toMatchObject({ success: false });
  });
});

describe("suppressionsFileSchema", () => {
  it("accepts files mapping rule ids to entries with a count, keeping each entry's other fields", () => {
    expect(
      suppressionsFileSchema.safeParse({
        "src/a.ts": {
          "rin-discipline/no-class-authoring": { count: 2 },
          "no-console": { count: 1, note: "legacy" },
        },
      }),
    ).toEqual({
      success: true,
      data: {
        "src/a.ts": {
          "rin-discipline/no-class-authoring": { count: 2 },
          "no-console": { count: 1, note: "legacy" },
        },
      },
    });
  });

  it("accepts an empty suppressions file", () => {
    expect(suppressionsFileSchema.safeParse({})).toEqual({ success: true, data: {} });
  });

  it.each([
    { "src/a.ts": ["rin-discipline/no-class-authoring"] },
    { "src/a.ts": { "rin-discipline/no-class-authoring": { count: "2" } } },
    { "src/a.ts": { "rin-discipline/no-class-authoring": {} } },
    { "src/a.ts": { "rin-discipline/no-class-authoring": 2 } },
    { "src/a.ts": "rin-discipline/no-class-authoring" },
  ])("refuses %j, which is not files mapping rule ids to entries with a numeric count", (file) => {
    expect(suppressionsFileSchema.safeParse(file)).toMatchObject({ success: false });
  });
});
