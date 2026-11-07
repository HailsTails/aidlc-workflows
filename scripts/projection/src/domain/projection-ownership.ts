import type { DistributionProduct, DistributionProductEdit } from "./distribution-products.ts";
import type { DistributionSeed, AssembledDistribution } from "./distribution-artifact.ts";
import type { HarnessBinding } from "./harness-binding.ts";
import { finding, sourceKey, type DocumentSource, type Outcome } from "./model.ts";
export type OwnedProductIdentity = { readonly key: string; readonly source: DocumentSource };
export type OwnedProductRecord = Omit<DistributionProduct, "files"> & { readonly files: readonly { readonly path: string; readonly mode: number; readonly sha256: string }[] };
export type ProjectionOwnership = { readonly schemaVersion: 1; readonly binding: HarnessBinding; readonly products: readonly OwnedProductRecord[] };
export type OwnershipDigest = (input: { readonly bytes: Uint8Array }) => string;
export type OwnershipPlan = { readonly edits: readonly DistributionProductEdit[]; readonly ownership: ProjectionOwnership };
const identity = ({ key, source }: OwnedProductIdentity): string => `${sourceKey(source)}/${key}`;
const recordIdentity = ({ record }: { readonly record: Pick<DistributionProduct, "key" | "owner"> }): string => identity({ key: record.key, source: record.owner.source });
const recordProduct = ({ product, digest }: { readonly product: DistributionProduct; readonly digest: OwnershipDigest }): OwnedProductRecord => ({ ...product, files: product.files.map((file) => ({ path: file.path, mode: file.mode, sha256: digest({ bytes: file.bytes }) })) });
export const issueCoreProjectionOwnership = ({ distribution, products: projections, preparedProducts = [], digest }: { readonly distribution: AssembledDistribution; readonly products: readonly DistributionProduct[]; readonly preparedProducts?: readonly DistributionProduct[]; readonly digest: OwnershipDigest }): Outcome<ProjectionOwnership> => {
  const products = [...projections, ...preparedProducts];
  const paths = products.flatMap((product) => product.files.map((file) => file.path));
  const keys = products.map((product) => recordIdentity({ record: product }));
  if (products.length === 0 || new Set(paths).size !== paths.length || new Set(keys).size !== keys.length) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "core-projection-issuance", detail: "issue a nonempty core projection with unique product identities and file paths" })] };
  const invalidProducts = products.filter((product) => !/^[a-z][a-z0-9-]*$/.test(product.key) || product.files.length === 0 || product.inputs.length === 0 || product.binding.harness !== distribution.binding.harness || product.binding.directory !== distribution.binding.directory || sourceKey(product.owner.source) !== sourceKey(distribution.seed.source) || product.owner.pin !== distribution.seed.pin || product.inputs.some((origin) => sourceKey(origin.source) !== sourceKey(distribution.seed.source) || origin.pin !== distribution.seed.pin));
  if (distribution.seed.source.kind !== "core" || invalidProducts.length > 0) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-projection-issuance", detail: "initial core issuance requires the assembled binding and exact core owner/compiler source basis" })] };
  const mismatches = products.flatMap((product) => product.files.filter((file) => {
    const assembled = distribution.files.find((candidate) => candidate.path === file.path);
    const finalizerOwned = file.path === `${distribution.binding.directory}/tools/data/aidlc-projection.json` || file.path === `${distribution.binding.directory}/tools/data/aidlc-stamp.json` || file.path.startsWith(`${distribution.binding.directory}/tools/data/root-blocks/`);
    return finalizerOwned || !distribution.replaced.includes(file.path) || !preparedProducts.includes(product) && file.path.startsWith(`${distribution.binding.directory}/tools/data/`) || assembled === undefined || assembled.mode !== file.mode || assembled.bytes.length !== file.bytes.length || !assembled.bytes.every((byte, index) => byte === file.bytes[index]);
  }));
  return mismatches.length > 0 ? { status: "invalid", findings: mismatches.map((file) => finding({ code: "foreign-content", subject: file.path, detail: "initial ownership must describe an actually projected final file with identical bytes and mode; retained native files are not projected products" })) } : { status: "ok", value: { schemaVersion: 1, binding: distribution.binding, products: products.map((product) => recordProduct({ product, digest })) } };
};
const restoreProduct = ({ record, seed }: { readonly record: OwnedProductRecord; readonly seed: DistributionSeed }): DistributionProduct => ({ ...record, files: record.files.map((file) => ({ path: file.path, mode: file.mode, bytes: seed.files.find((current) => current.path === file.path)?.bytes ?? new Uint8Array() })) });
export const planOwnedProducts = ({ ownership, seed, products, retirements, digest }: { readonly ownership: ProjectionOwnership; readonly seed: DistributionSeed; readonly products: readonly DistributionProduct[]; readonly retirements: readonly OwnedProductIdentity[]; readonly digest: OwnershipDigest }): Outcome<OwnershipPlan> => {
  if (ownership.binding.harness !== seed.binding.harness || ownership.binding.directory !== seed.binding.directory)
    return { status: "invalid", findings: [finding({ code: "harness-mismatch", subject: "projection-ownership", detail: "ownership record must target the current seed binding" })] };
  const conflicts = ownership.products.flatMap((record) => record.files.flatMap((file) => {
    const current = seed.files.find((candidate) => candidate.path === file.path);
    return current !== undefined && (digest({ bytes: current.bytes }) !== file.sha256 || current.mode !== file.mode) ? [finding({ code: "foreign-content", subject: file.path, detail: "persisted ownership differs from current bytes or mode; preserve the changed file and resolve ownership explicitly" })] : [];
  }));
  const desiredKeys = products.map((product) => recordIdentity({ record: product })), retiredKeys = retirements.map((retirement) => identity(retirement));
  const unknown = retiredKeys.filter((key) => !ownership.products.some((record) => recordIdentity({ record }) === key));
  const selectedKeys = [...desiredKeys, ...retiredKeys];
  const duplicate = selectedKeys.filter((key, index) => selectedKeys.indexOf(key) !== index);
  const retained = ownership.products.filter((record) => ![...desiredKeys, ...retiredKeys].includes(recordIdentity({ record })));
  const claims = [...retained.flatMap((record) => record.files.map((file) => file.path)), ...products.flatMap((product) => product.files.map((file) => file.path))];
  const collisions = claims.filter((path, index) => claims.indexOf(path) !== index);
  const findings = [...conflicts, ...collisions.map((subject) => finding({ code: "destination-collision", subject, detail: "persisted and desired products must retain one owner per path, including absent files" })), ...unknown.map((subject) => finding({ code: "foreign-content", subject, detail: "retirement requires an existing persisted product record" })), ...[...new Set(duplicate)].map((subject) => finding({ code: "duplicate", subject, detail: "select each product once for projection or retirement" }))];
  if (findings.length > 0) return { status: "invalid", findings };
  const edits: readonly DistributionProductEdit[] = [...products.map((product): DistributionProductEdit => {
    const record = ownership.products.find((candidate) => recordIdentity({ record: candidate }) === recordIdentity({ record: product }));
    return record === undefined ? { kind: "add", product } : { kind: "replace", previous: restoreProduct({ record, seed }), product };
  }), ...ownership.products.filter((record) => retiredKeys.includes(recordIdentity({ record }))).map((record): DistributionProductEdit => ({ kind: "remove", previous: restoreProduct({ record, seed }) }))];
  return { status: "ok", value: { edits, ownership: { schemaVersion: 1, binding: seed.binding, products: [...retained, ...products.map((product) => recordProduct({ product, digest }))] } } };
};
