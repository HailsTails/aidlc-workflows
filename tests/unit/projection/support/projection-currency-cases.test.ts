import { expect, test } from "bun:test";
import { projectionCurrencyCases } from "./projection-currency-cases.ts";

test("currency fixtures partition co-located suites while retaining source order", () => {
  expect(projectionCurrencyCases({ paths: [
    "scripts/projection/src/domain/model.ts",
    "scripts/projection/src/domain/model.test.ts",
    "scripts/projection/src/application/projection-set.test.ts",
    "scripts/projection/src/application/projection-set.ts",
    "scripts/projection/src/adapters/source-runtime-modules.test.ts",
    "scripts/projection/src/domain/nested/model.test.ts",
    "scripts/projection/examples/model.test.ts",
  ] })).toEqual({
    sources: ["scripts/projection/src/domain/model.ts", "scripts/projection/src/application/projection-set.ts"],
    tests: ["scripts/projection/src/domain/model.test.ts", "scripts/projection/src/application/projection-set.test.ts", "scripts/projection/src/adapters/source-runtime-modules.test.ts", "scripts/projection/src/domain/nested/model.test.ts", "scripts/projection/examples/model.test.ts"],
  });
});

test("currency fixtures keep ordinary modules and paths outside the projection inventory", () => {
  expect(projectionCurrencyCases({ paths: [
    "scripts/projection/src/domain/model.checks.ts",
    "scripts/projection/src/domain/model.spec.ts",
    "scripts/projection/src/domain/model.test.ts.backup",
    "core/projection/src/domain/model.test.ts",
    "scripts/other/src/domain/model.test.ts",
    "other/scripts/projection/model.test.ts",
  ] })).toEqual({ sources: [
    "scripts/projection/src/domain/model.checks.ts",
    "scripts/projection/src/domain/model.spec.ts",
    "scripts/projection/src/domain/model.test.ts.backup",
    "core/projection/src/domain/model.test.ts",
    "scripts/other/src/domain/model.test.ts",
    "other/scripts/projection/model.test.ts",
  ], tests: [] });
});

test("empty currency fixture inventory remains empty", () => {
  expect(projectionCurrencyCases({ paths: [] })).toEqual({ sources: [], tests: [] });
});
