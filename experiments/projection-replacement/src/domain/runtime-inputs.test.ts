import { expect, test } from "bun:test";
import { collectRuntimeInputEvidence, runtimeContextInputEvidence } from "./runtime-inputs.ts";
import { assetInputPreparation } from "../../__tests__/runtime-asset-delivery-fixtures.ts";
import { contextInputPreparation } from "../../__tests__/distribution-context-fixtures.ts";
test("different preparation families retain paths and witnesses in declared order", () => {
  expect(collectRuntimeInputEvidence({ preparations: [assetInputPreparation, contextInputPreparation] })).toEqual({ paths: [".claude/tools/data/model-rates.json", ".claude/tools/data/harness.json"], inputs: [{ path: "core/tools/data/model-rates.json", sha256: "rates-source" }, { path: "scripts/harness-runtime-data.ts", sha256: "source-descriptor-api" }] });
  expect(runtimeContextInputEvidence({ preparations: [assetInputPreparation, contextInputPreparation] })).toEqual({ paths: [".claude/tools/data/harness.json"], inputs: [{ path: "scripts/harness-runtime-data.ts", sha256: "source-descriptor-api" }] });
});
test("native input and asset-only input do not invent context evidence", () => {
  expect(collectRuntimeInputEvidence({})).toEqual({ paths: [], inputs: [] });
  expect(runtimeContextInputEvidence({})).toBeUndefined();
  expect(runtimeContextInputEvidence({ preparations: [assetInputPreparation] })).toBeUndefined();
});
