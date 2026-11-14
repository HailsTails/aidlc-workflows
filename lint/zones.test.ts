import { describe, expect, test } from "bun:test";
import { auditExcludes, moduleKindOf, zoneOf } from "./zones.ts";

describe("zoneOf", () => {
  test("src and lint are clean, and so is the package build entry", () => {
    expect(zoneOf("src/kernel/values.ts")).toBe("clean");
    expect(zoneOf("lint/zones.ts")).toBe("clean");
    expect(zoneOf("scripts/package.ts")).toBe("clean");
  });

  test("the gate is scaffolding inside the clean lint folder", () => {
    expect(zoneOf("lint/gate/domain/glob.ts")).toBe("scaffolding");
    expect(zoneOf("scripts/gate.ts")).toBe("scaffolding");
  });

  test("everything else is debt", () => {
    expect(zoneOf("scripts/package-release.ts")).toBe("debt");
    expect(zoneOf("core/tools/aidlc-lib.ts")).toBe("debt");
  });
});

describe("moduleKindOf", () => {
  test("tells TypeScript modules from other files", () => {
    expect(moduleKindOf("lint/zones.ts")).toBe("typescript");
    expect(moduleKindOf("disciplines.eslint.d.mts")).toBe("typescript");
    expect(moduleKindOf("lanes.json")).toBe("other");
  });
});

describe("auditExcludes", () => {
  test("excludes the shallowest folder that holds no clean file", () => {
    const tracked = [
      "core/tools/aidlc-lib.ts",
      "core/README.md",
      "lint/zones.ts",
      "lint/gate/domain/glob.ts",
      "scripts/gate.ts",
      "scripts/package.ts",
      "src/kernel/values.ts",
      "tsconfig.json",
      "README.md",
    ];

    expect(auditExcludes(tracked)).toEqual([
      "core",
      "lint/gate",
      "scripts/gate.ts",
      "tsconfig.json",
    ]);
  });
});
