import { describe, expect, test } from "bun:test";
import { joinNativePath } from "./native-path.ts";

describe("joinNativePath", () => {
  test("joins under a drive path with a backslash", () => {
    expect(joinNativePath({ base: "C:\\proj", segments: ["tools", "aidlc.ts"] })).toBe("C:\\proj\\tools\\aidlc.ts");
  });

  test("unifies a forward-slash drive path onto backslashes", () => {
    expect(joinNativePath({ base: "C:/proj", segments: ["tools", "aidlc.ts"] })).toBe("C:\\proj\\tools\\aidlc.ts");
  });

  test("joins under a posix path with a slash", () => {
    expect(joinNativePath({ base: "/home/p", segments: ["tools", "aidlc.ts"] })).toBe("/home/p/tools/aidlc.ts");
  });

  test("keeps a UNC prefix and joins with backslashes", () => {
    expect(joinNativePath({ base: "//server/share/p", segments: ["x"] })).toBe("\\\\server\\share\\p\\x");
  });

  test("keeps a trailing separator on the last segment", () => {
    expect(joinNativePath({ base: "/home/p", segments: ["x/"] })).toBe("/home/p/x/");
  });

  test("resolves a parent segment and drops a dot segment", () => {
    expect(joinNativePath({ base: "C:\\proj", segments: ["a", "..", "b", "."] })).toBe("C:\\proj\\b");
  });

  test("resolves a parent segment under a posix path", () => {
    expect(joinNativePath({ base: "/home/p", segments: ["a", "..", "b"] })).toBe("/home/p/b");
  });

  test("collapses repeated separators", () => {
    expect(joinNativePath({ base: "/home//p", segments: ["x"] })).toBe("/home/p/x");
  });
});