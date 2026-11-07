// covers: function:coreProjectionDeclarations, function:coreFileProjection, function:coreProjectionCoverage

import { expect, test } from "bun:test";
import { coreFileProjection, coreProjectionCoverage, coreProjectionDeclarations } from "./core-projection-contract.ts";

test("no native additions impose no publication obligation", () => {
  const declarations = coreProjectionDeclarations({ declarations: [] });
  expect(coreProjectionCoverage({ declarations, publishedPaths: new Set() })).toEqual({ kind: "covered" });
});

test("duplicate declaration paths retain first position and last supplied lines", () => {
  const declarations = coreProjectionDeclarations({ declarations: [
    { file: "agents/product.md", lines: ["tools: [read]"] },
    { file: "agents/developer.md", lines: ["tools: [read, write]"] },
    { file: "agents/product.md", lines: ["tools: [read, shell]"] },
  ] });
  expect([...declarations]).toEqual([
    ["agents/product.md", ["tools: [read, shell]"]],
    ["agents/developer.md", ["tools: [read, write]"]],
  ]);
});

test("declared lines retain their supplied identity without mutation", () => {
  const lines = ["tools: [read]"];
  const supplied = [{ file: "agents/product.md", lines }];
  const declarations = coreProjectionDeclarations({ declarations: supplied });
  expect(coreFileProjection({ path: "agents/product.md", declarations }).additions).toBe(lines);
  expect(supplied).toEqual([{ file: "agents/product.md", lines: ["tools: [read]"] }]);
});

test.each(["aidlc-common/protocols/construction.md", "aidlc-common/protocols/a.md", "aidlc-common/protocols/tool bindings.md"])("only the current harness bindings ship in a top-level protocol: %s", (path) => {
  expect(coreFileProjection({ path, declarations: new Map() })).toEqual({ bindingScope: "own-harness", additions: undefined });
});

test.each(["aidlc-common/protocols/.md", "aidlc-common/protocols/nested/construction.md", "aidlc-common/protocols/construction.MD", "aidlc-common/protocols/construction.json", "./aidlc-common/protocols/construction.md", "aidlc-common\\protocols\\construction.md", "other/protocols/construction.md", "agents/product.md"])("other projected paths keep their content bindings: %s", (path) => {
  expect(coreFileProjection({ path, declarations: new Map() })).toEqual({ bindingScope: "unchanged", additions: undefined });
});

test("binding scope and native frontmatter are independent decisions", () => {
  const path = "aidlc-common/protocols/construction.md";
  const lines = ["native: true"];
  const declarations = coreProjectionDeclarations({ declarations: [{ file: path, lines }] });
  expect(coreFileProjection({ path, declarations })).toEqual({ bindingScope: "own-harness", additions: lines });
});

test("an empty declared line list remains a declared extension", () => {
  const path = "agents/product.md";
  const declarations = coreProjectionDeclarations({ declarations: [{ file: path, lines: [] }] });
  expect(coreFileProjection({ path, declarations }).additions).toEqual([]);
  expect(coreProjectionCoverage({ declarations, publishedPaths: new Set() })).toEqual({ kind: "missing-declarations", paths: [path] });
});

test("published declarations are covered while unrelated publications impose no obligation", () => {
  const declarations = coreProjectionDeclarations({ declarations: [{ file: "agents/product.md", lines: [] }] });
  expect(coreProjectionCoverage({ declarations, publishedPaths: new Set(["unrelated.md", "agents/product.md", "agents/product.md"]) })).toEqual({ kind: "covered" });
});

test("missing paths retain declaration order and only successful publications count", () => {
  const declarations = coreProjectionDeclarations({ declarations: [
    { file: "agents/z.md", lines: [] }, { file: "agents/a.md", lines: [] },
    { file: "agents/done.md", lines: [] }, { file: "agents/z.md", lines: ["native: true"] },
  ] });
  const publishedPaths = new Set(["agents/done.md", "unrelated.md"]);
  expect(coreProjectionCoverage({ declarations, publishedPaths })).toEqual({ kind: "missing-declarations", paths: ["agents/z.md", "agents/a.md"] });
  expect([...publishedPaths]).toEqual(["agents/done.md", "unrelated.md"]);
  expect([...declarations]).toEqual([["agents/z.md", ["native: true"]], ["agents/a.md", []], ["agents/done.md", []]]);
});
