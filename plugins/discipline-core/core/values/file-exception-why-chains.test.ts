import { describe, expect, it } from "vitest";
import { fileExceptionWhyChainsSchema } from "./file-exception-why-chains.ts";

describe("fileExceptionWhyChainsSchema", () => {
  it.each(["required", "optional"])("accepts %s", (whyChains) => {
    expect(fileExceptionWhyChainsSchema.safeParse(whyChains)).toEqual({ success: true, data: whyChains });
  });

  it.each(["off", "", "Optional", false])("refuses %j", (whyChains) => {
    expect(fileExceptionWhyChainsSchema.safeParse(whyChains).success).toBe(false);
  });
});
