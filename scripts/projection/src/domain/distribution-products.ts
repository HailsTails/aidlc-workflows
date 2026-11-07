import { distributionDirectoryFindings, type DistributionFile, type DistributionSeed, type AssembledDistribution } from "./distribution-artifact.ts";
import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceBasis, SourceOrigin } from "./source-origin.ts";
import { finding, sourceKey, type Finding, type Outcome } from "./model.ts";
export type DistributionProduct = { readonly key: string; readonly owner: SourceBasis; readonly binding: HarnessBinding; readonly inputs: readonly SourceOrigin[]; readonly requiredByProducer: readonly string[]; readonly files: readonly DistributionFile[] };
export type DistributionProductEdit = { readonly kind: "add"; readonly product: DistributionProduct } | { readonly kind: "replace"; readonly previous: DistributionProduct; readonly product: DistributionProduct } | { readonly kind: "remove"; readonly previous: DistributionProduct };
export type ReconciledDistribution = AssembledDistribution & { readonly added: readonly string[]; readonly removed: readonly string[]; readonly projected: readonly { readonly key: string; readonly owner: SourceBasis; readonly paths: readonly string[] }[] };
export type DistributionProductRules = { readonly path: (input: { readonly path: string }) => "safe" | "unsafe" };
export type DistributionProductRequest = { readonly seed: DistributionSeed; readonly edits: readonly DistributionProductEdit[]; readonly sources: readonly SourceBasis[]; readonly protectedPaths: readonly string[]; readonly requiredPaths: readonly string[] };
const previousProducts = ({ edits }: { readonly edits: readonly DistributionProductEdit[] }): readonly DistributionProduct[] => edits.flatMap((edit) => edit.kind === "add" ? [] : [edit.previous]);
const desiredProducts = ({ edits }: { readonly edits: readonly DistributionProductEdit[] }): readonly DistributionProduct[] => edits.flatMap((edit) => edit.kind === "remove" ? [] : [edit.product]);
const productIdentity = ({ product }: { readonly product: DistributionProduct }): string => `${sourceKey(product.owner.source)}/${product.key}`;
const compareProductBytes = ({ first, second }: { readonly first: Uint8Array; readonly second: Uint8Array }): "equal" | "different" => first.length === second.length && first.every((byte, index) => byte === second[index]) ? "equal" : "different";
const productFindings = ({ product, request, rules }: { readonly product: DistributionProduct; readonly request: DistributionProductRequest; readonly rules: DistributionProductRules }): readonly Finding[] => [
  ...(!/^[a-z][a-z0-9-]*$/.test(product.key) ? [finding({ code: "invalid-identifier", subject: product.key, detail: "distribution product keys must be canonical identifiers" })] : []),
  ...(product.binding.harness !== request.seed.binding.harness || product.binding.directory !== request.seed.binding.directory ? [finding({ code: "harness-mismatch", subject: product.key, detail: "distribution products must target the seed's binding" })] : []),
  ...(!request.sources.some((basis) => sourceKey(basis.source) === sourceKey(product.owner.source) && basis.pin === product.owner.pin) ? [finding({ code: "foreign-content", subject: product.key, detail: "declare each product owner's exact source basis before reconciliation" })] : []),
  ...(product.files.length === 0 ? [finding({ code: "empty-integration", subject: product.key, detail: "an owned distribution product must contain files" })] : []),
  ...product.files.flatMap((file) => [
    ...(!Number.isInteger(file.mode) || file.mode < 0 || file.mode > 0o777 ? [finding({ code: "invalid-input", subject: file.path, detail: "owned product files require permission modes between 0 and 0777" })] : []),
    ...(rules.path({ path: file.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: file.path, detail: "owned product files require safe relative paths" })] : []),
    ...(request.protectedPaths.includes(file.path) || file.path.startsWith(`${request.seed.binding.directory}/tools/data/`) ? [finding({ code: "capability-gap", subject: file.path, detail: "producer-owned metadata cannot be reconciled as a projected product" })] : []),
  ]),
];
const editFindings = ({ request, rules }: { readonly request: DistributionProductRequest; readonly rules: DistributionProductRules }): readonly Finding[] => {
  const previous = previousProducts(request), desired = desiredProducts(request);
  const oldFiles = previous.flatMap((product) => product.files), nextFiles = desired.flatMap((product) => product.files);
  const subjects = request.edits.map((edit) => productIdentity({ product: edit.kind === "remove" ? edit.previous : edit.product }));
  return [
    ...distributionDirectoryFindings({ directories: request.seed.directories, files: request.seed.files, path: rules.path }),
    ...[...previous, ...desired].flatMap((product) => productFindings({ product, request, rules })),
    ...subjects.filter((subject, index) => subjects.indexOf(subject) !== index).map((subject) => finding({ code: "duplicate", subject, detail: "select one explicit edit per distribution product" })),
    ...request.edits.flatMap((edit) => edit.kind === "replace" && productIdentity({ product: edit.previous }) !== productIdentity({ product: edit.product }) ? [finding({ code: "foreign-content", subject: edit.product.key, detail: "replacement must preserve product identity and owner; use explicit remove and add for a transfer" })] : []),
    ...desired.flatMap((product) => product.requiredByProducer.filter((path) => !request.requiredPaths.includes(path)).map((path) => finding({ code: "capability-gap", subject: path, detail: "current native definitions do not require this projected product; regenerate products from the current prepared runtime" }))),
    ...oldFiles.flatMap((file, index) => {
      const current = request.seed.files.find((candidate) => candidate.path === file.path);
      return [
        ...(oldFiles.findIndex((candidate) => candidate.path === file.path) !== index ? [finding({ code: "destination-collision", subject: file.path, detail: "previous product footprints must have one owner" })] : []),
        ...(current !== undefined && compareProductBytes({ first: current.bytes, second: file.bytes }) !== "equal" ? [finding({ code: "foreign-content", subject: file.path, detail: "previous projected bytes do not match the seed; preserve the changed or unproven file" })] : []),
      ];
    }),
    ...nextFiles.flatMap((file, index) => [
      ...(request.seed.directories.some((directory) => directory.path === file.path) ? [finding({ code: "destination-collision", subject: file.path, detail: "a native file cannot replace a retained distribution directory" })] : []),
      ...(nextFiles.findIndex((candidate) => candidate.path === file.path) !== index ? [finding({ code: "destination-collision", subject: file.path, detail: "desired product footprints must have one owner" })] : []),
      ...(request.seed.files.some((candidate) => candidate.path === file.path) && !oldFiles.some((candidate) => candidate.path === file.path) ? [finding({ code: "destination-collision", subject: file.path, detail: "an addition cannot claim an existing seed file, even when its bytes match" })] : []),
    ]),
    ...(request.edits.length === 0 ? [finding({ code: "empty-integration", subject: "distribution-products", detail: "select explicit product additions, replacements or removals" })] : []),
  ];
};
export type DistributionProductReconciler = { readonly reconcile: (input: DistributionProductRequest) => Outcome<ReconciledDistribution> };
export const createDistributionProductReconciler = ({ rules }: { readonly rules: DistributionProductRules }): DistributionProductReconciler => ({
  reconcile: (request) => {
    const findings = editFindings({ request, rules });
    if (findings.length > 0) return { status: "invalid", findings };
    const previous = previousProducts(request).flatMap((product) => product.files), desired = desiredProducts(request);
    const nextFiles = desired.flatMap((product) => product.files);
    const kept = request.seed.files.filter((file) => !previous.some((prior) => prior.path === file.path));
    const added = nextFiles.filter((file) => !request.seed.files.some((prior) => prior.path === file.path)).map((file) => file.path);
    const removed = previous.filter((file) => request.seed.files.some((current) => current.path === file.path) && !nextFiles.some((next) => next.path === file.path)).map((file) => file.path);
    const files = [...kept, ...nextFiles];
    const missingRequirements = request.requiredPaths.filter((path) => !files.some((file) => file.path === path)).map((path) => finding({ code: "capability-gap", subject: path, detail: "native producer still requires this file; reconcile its definitions before removing the projected product" }));
    if (missingRequirements.length > 0) return { status: "invalid", findings: missingRequirements };
    const overlaps = files.filter((file) => files.some((other) => other.path !== file.path && other.path.startsWith(`${file.path}/`))).map((file) => finding({ code: "destination-collision", subject: file.path, detail: "a native file cannot also be another file's parent directory" }));
    if (overlaps.length > 0) return { status: "invalid", findings: overlaps };
    return { status: "ok", value: { seed: request.seed.basis, binding: request.seed.binding, files, directories: request.seed.directories, replaced: nextFiles.filter((file) => request.seed.files.some((prior) => prior.path === file.path)).map((file) => file.path), retained: kept.map((file) => file.path), added, removed, projected: desired.map((product) => ({ key: product.key, owner: product.owner, paths: product.files.map((file) => file.path) })) } };
  },
});
