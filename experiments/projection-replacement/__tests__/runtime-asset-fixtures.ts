import { mock, type Mock } from "bun:test";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { RuntimeAssetSourceOperations } from "../src/adapters/runtime-asset-sources.ts";

export const runtimeAssetBasis: SourceBasis = { source: { kind: "core", id: "framework" }, pin: "1111111111111111111111111111111111111111" };
export const runtimeAssetInventory = [
  { path: "core/tools/data/ars-priors.json", bytes: new Uint8Array([255, 0, 13, 10]) },
  { path: "core/tools/data/model-rates.json", bytes: new Uint8Array([123, 125, 10]) },
  { path: "core/tools/data/templates/.gitkeep", bytes: new Uint8Array([]) },
];
export type RuntimeAssetFixture = { readonly operations: { readonly inventory: Mock<RuntimeAssetSourceOperations["inventory"]>; readonly digest: Mock<RuntimeAssetSourceOperations["digest"]> } };
export const createRuntimeAssetFixture = (): RuntimeAssetFixture => ({ operations: {
  inventory: mock<RuntimeAssetSourceOperations["inventory"]>().mockResolvedValue({ status: "ok", value: runtimeAssetInventory }),
  digest: mock<RuntimeAssetSourceOperations["digest"]>().mockReturnValueOnce("opaque-hash").mockReturnValueOnce("rates-hash").mockReturnValueOnce("empty-hash"),
} });
