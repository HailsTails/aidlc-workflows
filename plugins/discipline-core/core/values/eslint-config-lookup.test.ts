import { describe, expect, it } from "vitest";
import { eslintConfigLookupSchema } from "./eslint-config-lookup.ts";

describe("eslintConfigLookupSchema", () => {
  it.each(["nearest-to-file", "repository-root"])("accepts %s", (lookup) => {
    expect(eslintConfigLookupSchema.safeParse(lookup)).toEqual({ success: true, data: lookup });
  });

  it.each(["anywhere", "", "Nearest-To-File"])("refuses %j", (lookup) => {
    expect(eslintConfigLookupSchema.safeParse(lookup).success).toBe(false);
  });
});
