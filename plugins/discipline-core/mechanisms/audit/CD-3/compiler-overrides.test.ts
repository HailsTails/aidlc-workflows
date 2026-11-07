import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { JsoncParsePort } from "../runner/jsonc-parse.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerFile, WalkerRepository } from "../runner/walker-piece.ts";
import { createCompilerOverridesCheck } from "./compiler-overrides.ts";

const FILE = repoPathSchema.parse("tsconfig.json");
const SOURCE = '{"compilerOptions":{"strict":true}}';
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const STRICT = clauseAddressSchema.parse("CD-3#strict");
const UNCHECKED = clauseAddressSchema.parse("CD-3#no-unchecked-indexed-access");
const EXACT = clauseAddressSchema.parse("CD-3#exact-optional-property-types");
const OVERRIDE = clauseAddressSchema.parse("CD-3#no-implicit-override");
const FALLTHROUGH = clauseAddressSchema.parse("CD-3#no-fallthrough-cases-in-switch");
const PROPERTY = clauseAddressSchema.parse("CD-3#no-property-access-from-index-signature");
const CATCH = clauseAddressSchema.parse("consumer/CD-3#use-unknown-in-catch-variables");
const STRICT_CLAUSE: RunnerClause = { address: STRICT, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/audit/CD-3", settings: { module: "compiler-overrides.ts" } };
const UNCHECKED_CLAUSE: RunnerClause = { address: UNCHECKED, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/audit/CD-3", settings: { module: "compiler-overrides.ts" } };
const EXACT_CLAUSE: RunnerClause = { address: EXACT, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/audit/CD-3", settings: { module: "compiler-overrides.ts" } };
const OVERRIDE_CLAUSE: RunnerClause = { address: OVERRIDE, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/audit/CD-3", settings: { module: "compiler-overrides.ts" } };
const FALLTHROUGH_CLAUSE: RunnerClause = { address: FALLTHROUGH, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/audit/CD-3", settings: { module: "compiler-overrides.ts" } };
const PROPERTY_CLAUSE: RunnerClause = { address: PROPERTY, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/audit/CD-3", settings: { module: "compiler-overrides.ts" } };
const CATCH_CLAUSE: RunnerClause = { address: CATCH, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/audit/CD-3", settings: { module: "compiler-overrides.ts" } };
const CLAUSES: readonly RunnerClause[] = [STRICT_CLAUSE, UNCHECKED_CLAUSE, EXACT_CLAUSE, OVERRIDE_CLAUSE, FALLTHROUGH_CLAUSE, PROPERTY_CLAUSE, CATCH_CLAUSE];

const prepareCheck = (request: { readonly jsonc: JsoncParsePort; readonly clauses: readonly RunnerClause[]; readonly file?: WalkerFile["file"] }): PreparedWalkerCheck => {
  const repository: WalkerRepository = { files: [request.file ?? FILE], exists: vi.fn<WalkerRepository["exists"]>().mockReturnValue("present") };
  const prepared = createCompilerOverridesCheck({ jsonc: request.jsonc }).prepare({ clauses: request.clauses, repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD3 existing explicit compiler overrides", () => {
  it("returns every selected explicit flag in legacy policy order with one read and parse", () => {
    const source = '{"compilerOptions":{"useUnknownInCatchVariables":false,"noPropertyAccessFromIndexSignature":true,"noFallthroughCasesInSwitch":false,"noImplicitOverride":true,"exactOptionalPropertyTypes":false,"noUncheckedIndexedAccess":false,"strict":true}}';
    const parse = vi.fn<JsoncParsePort["parse"]>().mockReturnValue({ outcome: "ok", value: {
      compilerOptions: {
        useUnknownInCatchVariables: false,
        noPropertyAccessFromIndexSignature: true,
        noFallthroughCasesInSwitch: false,
        noImplicitOverride: true,
        exactOptionalPropertyTypes: false,
        noUncheckedIndexedAccess: false,
        strict: true,
      },
    } });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: source });
    const prepared = prepareCheck({ jsonc: { parse }, clauses: [CATCH_CLAUSE, PROPERTY_CLAUSE, FALLTHROUGH_CLAUSE, OVERRIDE_CLAUSE, EXACT_CLAUSE, UNCHECKED_CLAUSE, STRICT_CLAUSE] });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [
      { clause: STRICT, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.strict = true" },
      { clause: UNCHECKED, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.noUncheckedIndexedAccess = false" },
      { clause: EXACT, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.exactOptionalPropertyTypes = false" },
      { clause: OVERRIDE, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.noImplicitOverride = true" },
      { clause: FALLTHROUGH, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.noFallthroughCasesInSwitch = false" },
      { clause: PROPERTY, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.noPropertyAccessFromIndexSignature = true" },
      { clause: CATCH, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.useUnknownInCatchVariables = false" },
    ] } });
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source });
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("ignores an unselected present flag and a selected absent flag without evaluating inheritance", () => {
    const parse = vi.fn<JsoncParsePort["parse"]>().mockReturnValue({ outcome: "ok", value: { extends: "../tsconfig.base.json", compilerOptions: { strict: true, useUnknownInCatchVariables: false, outDir: "dist" } } });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, clauses: [STRICT_CLAUSE, UNCHECKED_CLAUSE] });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [
      { clause: STRICT, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.strict = true" },
    ] } });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it("retains presence-only observations for arbitrary JSON option values", () => {
    const parse = vi.fn<JsoncParsePort["parse"]>().mockReturnValue({ outcome: "ok", value: { compilerOptions: {
      strict: null,
      noUncheckedIndexedAccess: ["inherited"],
      exactOptionalPropertyTypes: { mode: "same" },
      noImplicitOverride: "inherited",
      noFallthroughCasesInSwitch: 0,
    } } });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, clauses: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [
      { clause: STRICT, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.strict = null" },
      { clause: UNCHECKED, anchor: { line: 1, column: 0 }, snippet: 'compilerOptions.noUncheckedIndexedAccess = ["inherited"]' },
      { clause: EXACT, anchor: { line: 1, column: 0 }, snippet: 'compilerOptions.exactOptionalPropertyTypes = {"mode":"same"}' },
      { clause: OVERRIDE, anchor: { line: 1, column: 0 }, snippet: 'compilerOptions.noImplicitOverride = "inherited"' },
      { clause: FALLTHROUGH, anchor: { line: 1, column: 0 }, snippet: "compilerOptions.noFallthroughCasesInSwitch = 0" },
    ] } });
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "missing compilerOptions", config: { extends: "../tsconfig.base.json" } },
    { name: "empty compilerOptions", config: { compilerOptions: {} } },
    { name: "unrelated options", config: { compilerOptions: { outDir: "dist", declaration: true } } },
  ])("completes a valid config with $name without findings", ({ config }) => {
    const parse = vi.fn<JsoncParsePort["parse"]>().mockReturnValue({ outcome: "ok", value: config });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, clauses: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [] } });
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it("propagates an affected config read failure before parsing", () => {
    const failure = { outcome: "failed", error: { kind: "file-unreadable", file: FILE, detail: "fixture read refused" } };
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file: FILE, detail: "fixture read refused" } });
    const parse = vi.fn<JsoncParsePort["parse"]>();
    const prepared = prepareCheck({ jsonc: { parse }, clauses: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual(failure);
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).not.toHaveBeenCalled();
  });

  it("attributes a parser refusal to this config while preserving its detail", () => {
    const parse = vi.fn<JsoncParsePort["parse"]>().mockReturnValue({ outcome: "failed", error: { detail: "fixture parser refused original input" } });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, clauses: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({ outcome: "failed", error: { kind: "file-unparseable", file: FILE, detail: "fixture parser refused original input" } });
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "null root", config: null },
    { name: "array root", config: [] },
    { name: "scalar root", config: "config" },
    { name: "null compilerOptions", config: { compilerOptions: null } },
    { name: "array compilerOptions", config: { compilerOptions: [] } },
    { name: "scalar compilerOptions", config: { compilerOptions: "strict" } },
  ])("refuses $name as an affected unparseable file", ({ config }) => {
    const parse = vi.fn<JsoncParsePort["parse"]>().mockReturnValue({ outcome: "ok", value: config });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, clauses: CLAUSES });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({ outcome: "failed", error: { kind: "file-unparseable", file: FILE, detail: expect.stringMatching(/\S/) } });
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "root config", fileName: "tsconfig.json" },
    { name: "nested package config", fileName: "packages/app/tsconfig.json" },
    { name: "physical script config", fileName: "scripts/tsconfig.json" },
    { name: "nested root-only directory config", fileName: "src/vendor/tsconfig.json" },
  ])("admits $name from the supplied candidate population", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const parse = vi.fn<JsoncParsePort["parse"]>().mockReturnValue({ outcome: "ok", value: {} });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const prepared = prepareCheck({ jsonc: { parse }, clauses: CLAUSES, file });

    expect(prepared.prepareFile({ file, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [] } });
    expect(readText).toHaveBeenCalledExactlyOnceWith();
    expect(parse).toHaveBeenCalledExactlyOnceWith({ source: SOURCE });
  });

  it.each([
    { name: "different basename", fileName: "tsconfig.base.json" },
    { name: "different basename case", fileName: "packages/app/TSConfig.json" },
    { name: "non-config union candidate", fileName: "src/example.ts" },
    { name: "all-depth excluded directory", fileName: "src/node_modules/tsconfig.json" },
    { name: "root-only excluded directory", fileName: "vendor/tsconfig.json" },
  ])("excludes $name without reading or parsing", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const parse = vi.fn<JsoncParsePort["parse"]>();
    const readText = vi.fn<WalkerFile["readText"]>();
    const prepared = prepareCheck({ jsonc: { parse }, clauses: CLAUSES, file });

    expect(prepared.prepareFile({ file, readText })).toEqual({ outcome: "ok", value: { kind: "skipped" } });
    expect(readText).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });
});
