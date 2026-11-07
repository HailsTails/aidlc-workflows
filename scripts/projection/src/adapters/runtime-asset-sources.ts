import { z } from "zod";
import { createAuthoredSourceInventory, type AuthoredSourceInventory } from "./authored-source-inventory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { RuntimeAssetRelativePath, RuntimeAssetSources } from "../domain/runtime-assets.ts";
import { finding, type Outcome } from "../domain/model.ts";

const assetPath = z.enum(["core/tools/data/ars-priors.json", "core/tools/data/model-rates.json", "core/tools/data/templates/.gitkeep"]);
const inventorySchema = z.array(z.strictObject({ path: assetPath, bytes: z.instanceof(Uint8Array) }));
export type RuntimeAssetSourceOperations = {
  readonly inventory: (input: { readonly sourceRoot: string }) => Promise<Outcome<unknown>>;
  readonly digest: (input: { readonly bytes: Uint8Array }) => string;
};
export type RuntimeAssetSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<RuntimeAssetSources>> };
export type RuntimeAssetSourceDependencies = { readonly inventory?: Pick<AuthoredSourceInventory, "read">; readonly digest?: RuntimeAssetSourceOperations["digest"] };
const readRawAssetInventory = async ({ sourceRoot, inventory }: { readonly sourceRoot: string; readonly inventory: Pick<AuthoredSourceInventory, "read"> }): Promise<Outcome<unknown>> => {
  try { return { status: "ok", value: await inventory.read({ sourceRoot, directory: "core/tools/data", encoding: "bytes" }) }; }
  catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "runtime-asset-sources", detail: "authored runtime asset inventory unavailable" })] }; }
};
export const createRuntimeAssetSourceOperations = ({ inventory = createAuthoredSourceInventory(), digest = createOwnershipDigest() }: RuntimeAssetSourceDependencies = {}): RuntimeAssetSourceOperations => ({ inventory: ({ sourceRoot }) => readRawAssetInventory({ sourceRoot, inventory }), digest });
const relativeAssetPath = ({ path }: { readonly path: z.infer<typeof assetPath> }): RuntimeAssetRelativePath => {
  switch (path) {
    case "core/tools/data/ars-priors.json": return "ars-priors.json";
    case "core/tools/data/model-rates.json": return "model-rates.json";
    case "core/tools/data/templates/.gitkeep": return "templates/.gitkeep";
  }
};
const admitAssetInventory = ({ candidate }: { readonly candidate: unknown }): Outcome<z.infer<typeof inventorySchema>> => {
  const inventory = inventorySchema.safeParse(candidate);
  if (!inventory.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "runtime-asset-sources", detail: "read only the three supported authored runtime asset paths as bytes; unsupported entries were not discarded" })] };
  if (new Set(inventory.data.map((entry) => entry.path)).size !== inventory.data.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "runtime-asset-sources", detail: "authored runtime asset paths must occur exactly once" })] };
  if (inventory.data.length !== 3) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "runtime-asset-sources", detail: "all three authored runtime assets are required before projection" })] };
  return { status: "ok", value: inventory.data };
};
const prepareAssetSources = ({ inventory, basis, operations }: { readonly inventory: z.infer<typeof inventorySchema>; readonly basis: SourceBasis; readonly operations: RuntimeAssetSourceOperations }): Outcome<RuntimeAssetSources> => {
  try {
    return { status: "ok", value: { basis, assets: inventory.map((entry) => ({ origin: { ...basis, path: entry.path }, relativePath: relativeAssetPath({ path: entry.path }), bytes: entry.bytes })), inputs: inventory.map((entry) => ({ path: entry.path, sha256: operations.digest({ bytes: entry.bytes }) })) } };
  } catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "runtime-asset-sources", detail: "authored runtime asset digest unavailable" })] }; }
};
const readAssetInventory = async ({ sourceRoot, operations }: { readonly sourceRoot: string; readonly operations: RuntimeAssetSourceOperations }): Promise<Outcome<z.infer<typeof inventorySchema>>> => {
  const inventory = await operations.inventory({ sourceRoot });
  if (inventory.status === "invalid") return inventory;
  return admitAssetInventory({ candidate: inventory.value });
};
const loadAssetSources = async ({ sourceRoot, basis, operations }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly operations: RuntimeAssetSourceOperations }): Promise<Outcome<RuntimeAssetSources>> => {
  const inventory = await readAssetInventory({ sourceRoot, operations });
  if (inventory.status === "invalid") return inventory;
  return prepareAssetSources({ inventory: inventory.value, basis, operations });
};
const admitAssetBasis = ({ basis }: { readonly basis: SourceBasis }): Outcome<SourceBasis> => {
  if (basis.source.kind !== "core" || basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "runtime-asset-sources", detail: "declare the framework source and full source pin before reading authored runtime assets" })] };
  return { status: "ok", value: basis };
};
export const createRuntimeAssetSourceReader = ({ operations = createRuntimeAssetSourceOperations() }: { readonly operations?: RuntimeAssetSourceOperations } = {}): RuntimeAssetSourceReader => ({ load: async ({ sourceRoot, basis }) => {
  const admittedBasis = admitAssetBasis({ basis });
  if (admittedBasis.status === "invalid") return admittedBasis;
  return loadAssetSources({ sourceRoot, basis: admittedBasis.value, operations });
} });
