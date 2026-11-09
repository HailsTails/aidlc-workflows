import { describe, expect, test } from "bun:test";
import type { Workspace } from "../application/ports.ts";
import { testReach } from "./test-reach.ts";

const FILES: Readonly<Record<string, string>> = {
  "tests/unit/a.test.ts": [
    'import { x } from "../../core/tools/lib.ts";',
    'import { y } from "../harness/helper";',
    'const INIT = join(REPO_ROOT, "core", "tools", "init.ts");',
    'const HOOKS = "hooks/aidlc-guard.ts";',
    'const TOOLS = join(REPO_ROOT, "scripts");',
  ].join("\n"),
  "tests/harness/helper.ts": 'export const h = "../../core/tools/deep.ts";',
  "core/tools/lib.ts": 'import { z } from "./leaf.ts";',
  "core/tools/leaf.ts": "export const z = 1;",
  "core/tools/init.ts": "export const i = 1;",
  "core/tools/deep.ts": "export const d = 1;",
  "hooks/aidlc-guard.ts": "export const g = 1;",
  "scripts/package.ts": "export const p = 1;",
};

const ABSOLUTE_LITERALS = [
  String.raw`const w = "/WindowsApps";`,
  String.raw`const c = "C:/Windows/Temp";`,
  String.raw`const d = "./"; const e = "../..";`,
  String.raw`const n = "dist/\n";`,
  String.raw`const z = "\u0000dist/bundle.js";`,
].join(" ");

const workspace: Workspace = {
  read: (path) => FILES[path],
  write: () => undefined,
  filesMatching: (globs) =>
    Object.keys(FILES).filter((path) =>
      globs.some((glob) => glob.endsWith("/**") && path.startsWith(glob.slice(0, -2))),
    ),
};

const reach = testReach({ workspace, tests: ["tests/unit/a.test.ts"] })["tests/unit/a.test.ts"];

describe("testReach", () => {
  test("it follows static imports transitively", () => {
    expect(reach).toContain("core/tools/lib.ts");
    expect(reach).toContain("core/tools/leaf.ts");
  });

  test("it resolves an import with no extension", () => {
    expect(reach).toContain("tests/harness/helper.ts");
  });

  test("it follows a path built with join and a path written as a plain string", () => {
    expect(reach).toContain("core/tools/init.ts");
    expect(reach).toContain("hooks/aidlc-guard.ts");
  });

  test("an absolute or drive-lettered literal names nothing in the repository", () => {
    const scanned: string[] = [];
    const probing: Workspace = {
      ...workspace,
      read: (path) => (path === "tests/unit/abs.test.ts" ? ABSOLUTE_LITERALS : undefined),
      filesMatching: (globs) => {
        scanned.push(...globs);
        return [];
      },
    };

    const reach = testReach({ workspace: probing, tests: ["tests/unit/abs.test.ts"] });

    expect(scanned).toEqual([]);
    expect(Object.values(reach)[0]).toBeDefined();
  });

  test("a path found inside a helper the test imports counts too", () => {
    expect(reach).toContain("core/tools/deep.ts");
  });

  test("a folder named in the test is reached for every file under it", () => {
    expect(reach).toContain("scripts/**");
  });
});
