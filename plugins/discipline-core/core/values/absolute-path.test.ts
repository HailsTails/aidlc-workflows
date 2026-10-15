import { describe, expect, it } from "vitest";
import { absolutePathSchema } from "./absolute-path.ts";

describe("absolutePathSchema", () => {
  it.each(["/x/y", "/home/user/repo", "C:\\x", "C:/x", "D:\\repo\\a.ts"])("accepts %j", (text) => {
    expect(absolutePathSchema.safeParse(text).success).toBe(true);
  });

  it.each(["", "x/y", "./x", "../x", "repo", "C:x", "C:", "x\\y"])("refuses %j", (text) => {
    expect(absolutePathSchema.safeParse(text).success).toBe(false);
  });

  it("parses a path to the same text", () => {
    expect(absolutePathSchema.parse("/home/user/repo")).toBe("/home/user/repo");
  });
});

describe("absolutePathSchema over UNC paths", () => {
  it.each(["\\\\server\\share\\", "\\\\server\\share\\repo\\x.ts"])("accepts the UNC path %j", (text) => {
    expect(absolutePathSchema.safeParse(text).success).toBe(true);
  });

  it.each(["\\\\server\\share", "\\\\server", "\\\\"])("refuses the incomplete UNC prefix %j", (text) => {
    expect(absolutePathSchema.safeParse(text).success).toBe(false);
  });
});
