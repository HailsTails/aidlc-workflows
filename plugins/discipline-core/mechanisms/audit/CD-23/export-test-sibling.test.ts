import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { SourceObservers, WalkerRepository } from "../runner/walker-piece.ts";
import { check } from "./export-test-sibling.ts";

const FILE = repoPathSchema.parse("src/view.tsx");
const SIBLING = repoPathSchema.parse("src/view.test.tsx");
const ADDRESS = clauseAddressSchema.parse("CD-23#export-test-sibling");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-23",
  settings: { module: "export-test-sibling.ts" },
};

const sourceObservations = (request: {
  readonly source: string;
  readonly repository: WalkerRepository;
}): SourceObservers => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: request.repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({
    file: FILE,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  return selected.value.begin({
    sourceFile: SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true),
    anchorAt: vi.fn().mockReturnValue({ line: 1, column: 0 }),
  });
};

describe("CD-23 existing exported-source sibling obligation", () => {
  it("reports an exported runtime source without its co-located test sibling at the file anchor", () => {
    const observers = sourceObservations({
      source: "export const value = 1;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent") },
    });

    expect(observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "missing co-located *.test.ts(x) sibling" },
    ]);
  });

  it("accepts the existing TSX test sibling in the supplied repository population", () => {
    const observers = sourceObservations({
      source: "export const value = 1;\n",
      repository: { files: [FILE, SIBLING], exists: vi.fn().mockReturnValue("present") },
    });

    expect(observers.finish()).toEqual([]);
  });

  it("reports a default-export assignment without its co-located test sibling", () => {
    const observers = sourceObservations({
      source: "export default value;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent") },
    });

    expect(observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "missing co-located *.test.ts(x) sibling" },
    ]);
  });

  it("reports a runtime named export without its co-located test sibling", () => {
    const observers = sourceObservations({
      source: "const value = 1;\nexport { value };\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent") },
    });

    expect(observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "missing co-located *.test.ts(x) sibling" },
    ]);
  });

  it("excludes both forms of type-only named exports from sibling obligations", () => {
    const observers = sourceObservations({
      source: "export type { First } from './first.ts';\nexport { type Second } from './second.ts';\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent") },
    });

    expect(observers.finish()).toEqual([]);
  });

  it("accepts an exported TS source with its matching TS test sibling", () => {
    const file = repoPathSchema.parse("src/value.ts");
    const sibling = repoPathSchema.parse("src/value.test.ts");
    const source = "export const value = 1;\n";
    const prepared = check.prepare({
      clauses: [CLAUSE],
      repository: { files: [file, sibling], exists: vi.fn().mockReturnValue("present") },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const selected = prepared.value.prepareFile({
      file,
      readText: vi.fn().mockReturnValue({ outcome: "ok", value: source }),
    });
    assert(selected.outcome === "ok");
    assert(selected.value.kind === "syntax");
    const observers = selected.value.begin({
      sourceFile: SYNTAX_API.createSourceFile(file, source, SYNTAX_API.ScriptTarget.Latest, true),
      anchorAt: vi.fn().mockReturnValue({ line: 1, column: 0 }),
    });

    expect(observers.finish()).toEqual([]);
  });

  it("retains type-only and declare-only export exclusions", () => {
    const observers = sourceObservations({
      source: "export type Value = { readonly name: string };\nexport declare const value: Value;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent") },
    });

    expect(observers.finish()).toEqual([]);
  });

  it("preserves the existing export-star and unexported-runtime classification gaps", () => {
    const observers = sourceObservations({
      source: "export * from './module.ts';\nconst hidden = 1;\n",
      repository: { files: [FILE], exists: vi.fn().mockReturnValue("absent") },
    });

    expect(observers.finish()).toEqual([]);
  });

  it.each([
    "src/view.test.ts",
    "src/view.js",
    "src/view.d.ts",
    "src/__tests__/fixture.ts",
    "src/node_modules/view.ts",
    "vendor/view.ts",
  ])("preserves the existing companion-check exclusion for %s", (fileName) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      clauses: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("absent") },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "ok", value: "export const value = 1;\n" });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toEqual({ outcome: "ok", value: { kind: "skipped" } });
    expect(readText).not.toHaveBeenCalled();
  });

  it.each(["src/vendor/view.ts", "src/scripts/task.ts", "scripts/task.ts", "ui/view.tsx"])("retains authored source for %s", (fileName) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("absent") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toMatchObject({ outcome: "ok", value: { kind: "syntax", begin: expect.any(Function) } });
    expect(readText).not.toHaveBeenCalled();
  });
});
