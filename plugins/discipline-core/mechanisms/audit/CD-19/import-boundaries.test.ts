import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, SourceObservers, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./import-boundaries.ts";

const FILE = repoPathSchema.parse("src/import-source.ts");
const ADDRESS = clauseAddressSchema.parse("CD-19#import-boundaries");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const FROM = "fr" + "om";
const IMPORT = "im" + "port";
const REQUIRE = "req" + "uire";
const LINE_COMMENT = "/" + "/";
const TEMPLATE_SUBSTITUTION = "$" + "{name}";
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-19",
  settings: { module: "import-boundaries.ts" },
};

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly readText: Mock<WalkerFile["readText"]>;
  readonly finish: PreparedWalkerCheck["finish"];
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [request.file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

const sourceObservations = (request: { readonly source: string }): ObservationFixture => {
  const prepared = preparedFor({ file: FILE });
  const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file: FILE, detail: "piece must use supplied source" } });
  const file = prepared.prepareFile({ file: FILE, readText });
  assert(file.outcome === "ok");
  assert(file.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 1, column: 0 });
  return { tree, observers: file.value.begin({ sourceFile: tree, anchorAt }), anchorAt, readText, finish: prepared.finish };
};

describe("CD-19 existing third-party and redirected stdlib import observations", () => {
  it("preserves raw type-only and comment matches, per-line policy order, deduplication and known text gaps", () => {
    const observed = sourceObservations({ source: `${IMPORT} type { Rule } ${FROM} "eslint";\r\nconst literal = " ${FROM} 'hono' ${FROM} 'winston' ${FROM} 'winston' ";\r\n${LINE_COMMENT} ${FROM} "uuid"\r\n${IMPORT} client ${FROM} "hono/client";\r\n${IMPORT} "winston"; ${REQUIRE}("winston"); ${IMPORT}("winston");\r\n${IMPORT} shape ${FROM}\r\n"pino";\r\n` });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "banned third-party import: eslint — use its recorded wrapping boundary" },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "banned third-party import: winston — use its recorded wrapping boundary" },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "banned third-party import: hono — use its recorded wrapping boundary" },
      { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: "banned third-party import: uuid — use its recorded wrapping boundary" },
    ]);
    expect(observed.readText).not.toHaveBeenCalled();
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("returns every raw hit before earlier and later observed stdlib imports under the CD19 clause", () => {
    const observed = sourceObservations({ source: `import fs ${FROM} "node:fs";\r\nimport logger ${FROM} "winston";\r\nexport * ${FROM} "node:path";\r\n` });
    const imported = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const exported = observed.tree.getChildAt(0, observed.tree).getChildAt(2, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 15 }).mockReturnValueOnce({ line: 3, column: 14 });

    observed.observers.enter?.({ node: imported });
    observed.observers.enter?.({ node: exported });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "banned third-party import: winston — use its recorded wrapping boundary" },
      { clause: ADDRESS, anchor: { line: 1, column: 15 }, snippet: "bare node: stdlib import - use the kernel port package: node:fs" },
      { clause: ADDRESS, anchor: { line: 3, column: 14 }, snippet: "bare node: stdlib import - use the kernel port package: node:path" },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 15 }], [{ position: 72 }]]);
    expect(observed.readText).not.toHaveBeenCalled();
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains import-type, external import-equals, dynamic import and literal require observations in supplied order", () => {
    const observed = sourceObservations({ source: `type Stats = ${IMPORT}("node:fs").Stats;\n${IMPORT} path = ${REQUIRE}("node:path");\n${IMPORT}("node:url");\n${REQUIRE}("node:crypto");\n` });
    const importType = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(3, observed.tree);
    const importEquals = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree);
    const dynamicImport = observed.tree.getChildAt(0, observed.tree).getChildAt(2, observed.tree).getChildAt(0, observed.tree);
    const required = observed.tree.getChildAt(0, observed.tree).getChildAt(3, observed.tree).getChildAt(0, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 20 }).mockReturnValueOnce({ line: 2, column: 22 }).mockReturnValueOnce({ line: 3, column: 7 }).mockReturnValueOnce({ line: 4, column: 8 });

    observed.observers.enter?.({ node: importType });
    observed.observers.enter?.({ node: importEquals });
    observed.observers.enter?.({ node: dynamicImport });
    observed.observers.enter?.({ node: required });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 20 }, snippet: "bare node: stdlib import - use the kernel port package: node:fs" },
      { clause: ADDRESS, anchor: { line: 2, column: 22 }, snippet: "bare node: stdlib import - use the kernel port package: node:path" },
      { clause: ADDRESS, anchor: { line: 3, column: 7 }, snippet: "bare node: stdlib import - use the kernel port package: node:url" },
      { clause: ADDRESS, anchor: { line: 4, column: 8 }, snippet: "bare node: stdlib import - use the kernel port package: node:crypto" },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 20 }], [{ position: 60 }], [{ position: 81 }], [{ position: 102 }]]);
  });

  it("preserves shadowed require and first-argument quirks while excluding property calls, computed strings and unprefixed modules", () => {
    const observed = sourceObservations({ source: `const ${REQUIRE} = loader;\n${REQUIRE}("node:fs", "ignored");\nloader.${REQUIRE}("node:path");\n${REQUIRE}(name);\n${REQUIRE}("fs");\n${IMPORT}(\`node:${TEMPLATE_SUBSTITUTION}\`);\n` });
    const shadowedRequire = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);
    const propertyRequire = observed.tree.getChildAt(0, observed.tree).getChildAt(2, observed.tree).getChildAt(0, observed.tree);
    const computedRequire = observed.tree.getChildAt(0, observed.tree).getChildAt(3, observed.tree).getChildAt(0, observed.tree);
    const unprefixedRequire = observed.tree.getChildAt(0, observed.tree).getChildAt(4, observed.tree).getChildAt(0, observed.tree);
    const templateImport = observed.tree.getChildAt(0, observed.tree).getChildAt(5, observed.tree).getChildAt(0, observed.tree);
    observed.anchorAt.mockReturnValue({ line: 2, column: 8 });

    observed.observers.enter?.({ node: shadowedRequire });
    observed.observers.enter?.({ node: propertyRequire });
    observed.observers.enter?.({ node: computedRequire });
    observed.observers.enter?.({ node: unprefixedRequire });
    observed.observers.enter?.({ node: templateImport });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 2, column: 8 }, snippet: "bare node: stdlib import - use the kernel port package: node:fs" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 32 });
  });

  it.each([
    { name: "all-depth exclusion", fileName: "src/node_modules/imports.ts", kind: "skipped" },
    { name: "root-only exclusion", fileName: "vendor/imports.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/imports.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/Imports.tsx", kind: "syntax" },
    { name: "test source", fileName: "src/imports.test.ts", kind: "syntax" },
    { name: "declaration source", fileName: "src/imports.d.ts", kind: "syntax" },
    { name: "physical script retained", fileName: "scripts/imports.ts", kind: "syntax" },
    { name: "non-TypeScript union candidate", fileName: "src/imports.js", kind: "skipped" },
  ])("preserves its own source population without reading for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected piece read" } });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });
});

