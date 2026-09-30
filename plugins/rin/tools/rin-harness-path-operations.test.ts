import { describe, expect, test } from "vitest";
import { pathOperationsFor } from "./rin-harness-path-operations.ts";

const win32Operations = pathOperationsFor({ flavour: "win32" });
const posixOperations = pathOperationsFor({ flavour: "posix" });

describe("pathOperationsFor under the win32 flavour", () => {
  test("names its flavour", () => {
    expect(win32Operations.flavour).toBe("win32");
  });

  test("resolves drive-qualified segments with win32 rules on any host", () => {
    expect(
      win32Operations.resolve({ segments: ["C:\\repo", "src/a.ts"] }),
    ).toBe("C:\\repo\\src\\a.ts");
  });

  test("relates two drive-qualified paths with win32 rules on any host", () => {
    expect(
      win32Operations.relative({ from: "C:\\repo", to: "C:\\repo\\src\\a.ts" }),
    ).toBe("src\\a.ts");
  });

  test("reads a drive-qualified path as absolute", () => {
    expect(win32Operations.isAbsolute({ path: "C:\\repo" })).toBe(true);
  });

  test("reads a bare relative path as not absolute", () => {
    expect(win32Operations.isAbsolute({ path: "src\\a.ts" })).toBe(false);
  });
});

describe("pathOperationsFor under the posix flavour", () => {
  test("names its flavour", () => {
    expect(posixOperations.flavour).toBe("posix");
  });

  test("resolves segments with posix rules on any host", () => {
    expect(posixOperations.resolve({ segments: ["/repo", "src/a.ts"] })).toBe(
      "/repo/src/a.ts",
    );
  });

  test("relates two paths with posix rules on any host", () => {
    expect(
      posixOperations.relative({ from: "/repo", to: "/repo/src/a.ts" }),
    ).toBe("src/a.ts");
  });

  test("reads a rooted path as absolute", () => {
    expect(posixOperations.isAbsolute({ path: "/repo" })).toBe(true);
  });

  test("reads a drive-qualified path as not absolute", () => {
    expect(posixOperations.isAbsolute({ path: "C:\\repo" })).toBe(false);
  });
});
