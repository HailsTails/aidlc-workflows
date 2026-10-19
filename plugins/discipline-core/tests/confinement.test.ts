import { describe, expect, it } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import {
  computedModuleLoad,
  filesNotMatching,
  importsOutside,
  nodeBuiltinImport,
  packageImport,
  packageOrComputedImport,
  packageTypeImport,
  pathCallsOutside,
  relativeImport,
  relativeImportOfAnyForm,
  relativeImportReaching,
} from "./confinement.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const underCore = relativeImportReaching({ importingFolder: "core/folder", reach: /^core\// });

describe("relativeImport", () => {
  it("allows a relative value import and a relative type-only import", () => {
    expect([
      relativeImport({ moduleImport: { specifier: "./a.ts", form: "value" } }),
      relativeImport({ moduleImport: { specifier: "../b.ts", form: "type-only" } }),
    ]).toEqual(["allowed", "allowed"]);
  });

  it("refuses a relative dynamic import and a package import", () => {
    expect([
      relativeImport({ moduleImport: { specifier: "./a.ts", form: "dynamic" } }),
      relativeImport({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["outside", "outside"]);
  });
});

describe("relativeImportOfAnyForm", () => {
  it("allows a relative dynamic import and refuses a package import", () => {
    expect([
      relativeImportOfAnyForm({ moduleImport: { specifier: "./a.ts", form: "dynamic" } }),
      relativeImportOfAnyForm({ moduleImport: { specifier: "vitest", form: "value" } }),
    ]).toEqual(["allowed", "outside"]);
  });
});

describe("nodeBuiltinImport", () => {
  it("allows a static node builtin import and refuses a dynamic one and a package", () => {
    expect([
      nodeBuiltinImport({ moduleImport: { specifier: "node:path", form: "value" } }),
      nodeBuiltinImport({ moduleImport: { specifier: "node:path", form: "dynamic" } }),
      nodeBuiltinImport({ moduleImport: { specifier: "path", form: "value" } }),
    ]).toEqual(["allowed", "outside", "outside"]);
  });
});

describe("computedModuleLoad", () => {
  it("allows a dynamic load of a computed specifier and refuses a literal one or a static import", () => {
    expect([
      computedModuleLoad({ moduleImport: { specifier: "pathToFileURL(request.path", form: "dynamic" } }),
      computedModuleLoad({ moduleImport: { specifier: "./runner.ts", form: "dynamic" } }),
      computedModuleLoad({ moduleImport: { specifier: "pathToFileURL(request.path", form: "value" } }),
    ]).toEqual(["allowed", "outside", "outside"]);
  });
});

describe("packageOrComputedImport", () => {
  it("allows any specifier not starting with a dot", () => {
    expect([
      packageOrComputedImport({ moduleImport: { specifier: "zod", form: "value" } }),
      packageOrComputedImport({ moduleImport: { specifier: "request.path", form: "dynamic" } }),
      packageOrComputedImport({ moduleImport: { specifier: "../a.ts", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "outside"]);
  });
});

describe("packageImport", () => {
  it("allows the named package by value or type only, and refuses another package or a dynamic load", () => {
    expect([
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "value" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "type-only" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint", form: "dynamic" } }),
      packageImport({ packageName: "eslint" })({ moduleImport: { specifier: "eslint-scope", form: "value" } }),
    ]).toEqual(["allowed", "allowed", "outside", "outside"]);
  });
});

describe("packageTypeImport", () => {
  it("allows the named package type only and refuses it by value", () => {
    expect([
      packageTypeImport({ packageName: "typescript" })({ moduleImport: { specifier: "typescript", form: "type-only" } }),
      packageTypeImport({ packageName: "typescript" })({ moduleImport: { specifier: "typescript", form: "value" } }),
    ]).toEqual(["allowed", "outside"]);
  });
});

describe("relativeImportReaching", () => {
  it("allows a relative import resolving inside the reach, of any form", () => {
    expect([
      underCore({ moduleImport: { specifier: "../values/result.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "./sibling.ts", form: "dynamic" } }),
    ]).toEqual(["allowed", "allowed"]);
  });

  it("refuses a relative import resolving outside the reach, and a package import", () => {
    expect([
      underCore({ moduleImport: { specifier: "../../mechanisms/audit/runner/runner.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "../../../outside.ts", form: "value" } }),
      underCore({ moduleImport: { specifier: "zod", form: "value" } }),
    ]).toEqual(["outside", "outside", "outside"]);
  });
});

describe("importsOutside", () => {
  it("lists each import no allowance allows, with its file, in source order", () => {
    expect(
      importsOutside({
        sources: {
          "./a.ts": 'import { z } from "zod";\nimport { b } from "./b.ts";\nimport ts from "typescript";\n',
          "./b.ts": 'export type { Padding } from "left-pad";\n',
        },
        allowed: [relativeImport, packageImport({ packageName: "zod" })],
      }),
    ).toEqual([
      { file: "./a.ts", specifier: "typescript", form: "value" },
      { file: "./b.ts", specifier: "left-pad", form: "type-only" },
    ]);
  });

  it("lists nothing when every import is allowed", () => {
    expect(
      importsOutside({
        sources: { "./a.ts": 'import { b } from "./b.ts";\nimport type { T } from "vitest";\n' },
        allowed: [relativeImport, packageImport({ packageName: "vitest" })],
      }),
    ).toEqual([]);
  });
});

describe("filesNotMatching", () => {
  it("lists each file whose whole text the pattern does not match", () => {
    expect(
      filesNotMatching({
        sources: { "./kept.ts": "const kept = 1;\n", "./broken.ts": 'import { x } from "../core/check/x.ts";\n' },
        pattern: /^(?!.*core\/check\/).*$/s,
      }),
    ).toEqual(["./broken.ts"]);
  });
});

describe("pathCallsOutside", () => {
  it("reports at least one call and lists the observed paths outside the root or the pattern", () => {
    expect(
      pathCallsOutside({
        path: posixPath,
        root: "/install",
        calls: [[{ path: "/install/core/a.ts" }], [{ path: "/install/tests/b.ts" }], [{ path: "/elsewhere/c.ts" }]],
        paths: /^core\//,
      }),
    ).toEqual({ called: "at least once", outside: ["/install/tests/b.ts", "/elsewhere/c.ts"] });
  });

  it("reports never when no call was made", () => {
    expect(pathCallsOutside({ path: posixPath, root: "/install", calls: [], paths: /^core\// })).toEqual({
      called: "never",
      outside: [],
    });
  });
});
