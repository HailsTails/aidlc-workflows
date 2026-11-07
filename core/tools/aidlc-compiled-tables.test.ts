// Byte-level table rendering and canonical region boundaries, without installed data reads.
import { expect, test } from "bun:test";
import {
  canonicalScopeTableRegion, canonicalStageTableRegion,
  renderScopeTable, renderStageTable,
  SCOPE_TABLE_BEGIN, SCOPE_TABLE_END, STAGE_TABLE_BEGIN, STAGE_TABLE_END,
} from "./aidlc-compiled-tables.ts";

test("an empty scope set renders only the two header lines", () => {
  expect(renderScopeTable({ mapping: () => ({}), scopes: () => new Set() })).toBe(
    "| Scope          | Depth         | TestStrategy | EXECUTE / Total |\n|----------------|---------------|--------------|-----------------|",
  );
});

test("scope rows retain supplied order and exact counts, padding and defaults", () => {
  expect(renderScopeTable({
    mapping: () => ({
      zeta: { depth: "Deep", stages: { plan: "EXECUTE", build: "SKIP", check: "EXECUTE" } },
      alpha: { depth: "Light", stages: {}, testStrategy: "" },
      "long-scope-name-exceeds-width": { depth: "Depth exceeding width", stages: { one: "SKIP" }, testStrategy: "Extended testing" },
    }),
    scopes: () => new Set(["zeta", "alpha", "long-scope-name-exceeds-width"]),
  })).toBe(
    "| Scope          | Depth         | TestStrategy | EXECUTE / Total |\n" +
    "|----------------|---------------|--------------|-----------------|\n" +
    "| zeta           | Deep          | (default)    | 2 / 3           |\n" +
    "| alpha          | Light         |              | 0 / 0           |\n" +
    "| long-scope-name-exceeds-width | Depth exceeding width | Extended testing | 0 / 1           |",
  );
});

test("only named scopes render and explicit strategies remain verbatim", () => {
  expect(renderScopeTable({
    mapping: () => ({
      kept: { depth: "a|b", stages: { first: "EXECUTE" }, testStrategy: "TDD" },
      omitted: { depth: "Deep", stages: {} },
    }),
    scopes: () => new Set(["kept"]),
  })).toBe(
    "| Scope          | Depth         | TestStrategy | EXECUTE / Total |\n" +
    "|----------------|---------------|--------------|-----------------|\n" +
    "| kept           | a|b           | TDD          | 1 / 1           |",
  );
});

test("an empty stage graph renders only the two header lines", () => {
  expect(renderStageTable(() => [])).toBe(
    "| Slug | # | Stage | Phase | Execution | Lead Agent | Support Agents | Mode |\n" +
    "|------|---|-------|-------|-----------|------------|----------------|------|",
  );
});

test("stage order, phase case, orchestrator and support formatting stay exact", () => {
  expect(renderStageTable(() => [
    { slug: "second", number: "02", name: "Build", phase: "construction", execution: "ALWAYS", leadAgent: "orchestrator", supportAgents: [], mode: "autonomous" },
    { slug: "first", number: "1a", name: "Plan | review", phase: "iNCEPTION", execution: "CONDITIONAL", leadAgent: "developer", supportAgents: ["quality", "architect"], mode: "review" },
    { slug: "empty", number: "", name: "", phase: "", execution: "ALWAYS", leadAgent: "Orchestrator", supportAgents: [""], mode: "" },
  ])).toBe(
    "| Slug | # | Stage | Phase | Execution | Lead Agent | Support Agents | Mode |\n" +
    "|------|---|-------|-------|-----------|------------|----------------|------|\n" +
    "| second | 02 | Build | Construction | ALWAYS | (orchestrator) | \u2014 | autonomous |\n" +
    "| first | 1a | Plan | review | INCEPTION | CONDITIONAL | developer | quality, architect | review |\n" +
    "| empty |  |  |  | ALWAYS | Orchestrator |  |  |",
  );
});

test("scope markers retain their literal labels", () => {
  expect(SCOPE_TABLE_BEGIN).toMatch(/^<!-- BEGIN: compiled scope grid via `.+ engine gen scope-table` - do NOT hand-edit -->$/);
  expect(SCOPE_TABLE_END).toBe("<!-- END: compiled scope grid -->");
});

test("stage markers retain their literal labels", () => {
  expect(STAGE_TABLE_BEGIN).toMatch(/^<!-- BEGIN: compiled stage graph via `.+ engine gen stage-table` - do NOT hand-edit -->$/);
  expect(STAGE_TABLE_END).toBe("<!-- END: compiled stage graph -->");
});

test.each([
  { table: "", ending: "\n\n\n\n<!-- END: compiled scope grid -->" },
  { table: "row", ending: "\n\nrow\n\n<!-- END: compiled scope grid -->" },
  { table: "\nrow\n", ending: "\n\n\nrow\n\n\n<!-- END: compiled scope grid -->" },
  { table: "first\r\nsecond", ending: "\n\nfirst\r\nsecond\n\n<!-- END: compiled scope grid -->" },
])("scope region preserves table bytes: $table", ({ table, ending }) => {
  expect(canonicalScopeTableRegion(table)).toStartWith(SCOPE_TABLE_BEGIN);
  expect(canonicalScopeTableRegion(table)).toEndWith(ending);
});

test.each([
  { table: "", ending: "\n\n\n\n<!-- END: compiled stage graph -->" },
  { table: "row", ending: "\n\nrow\n\n<!-- END: compiled stage graph -->" },
  { table: "\nrow\n", ending: "\n\n\nrow\n\n\n<!-- END: compiled stage graph -->" },
  { table: "first\r\nsecond", ending: "\n\nfirst\r\nsecond\n\n<!-- END: compiled stage graph -->" },
])("stage region preserves table bytes: $table", ({ table, ending }) => {
  expect(canonicalStageTableRegion(table)).toStartWith(STAGE_TABLE_BEGIN);
  expect(canonicalStageTableRegion(table)).toEndWith(ending);
});
