import { continuePreparation } from "./preparation-result.ts";
import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import type { claudeDistributionDescriptionPaths, DistributionDescriptionPreparer, DistributionDescriptionRequest, PreparedDistributionDescription } from "../domain/distribution-description.ts";
import type { prepareDistributionStructure } from "../domain/distribution-structure.ts";
import type { DistributionStructure } from "../domain/distribution-structure.ts";
import type { planPreparedRuntimeFiles } from "../domain/prepared-runtime-files.ts";
import type { ProjectionSet } from "./projection-set.ts";
import type { DistributionAssemblyRules } from "./distribution-assembly.ts";
import { finding, type Outcome } from "../domain/model.ts";

export type DescribeDistributionRequest = { readonly sourceRoot: string; readonly root: string; readonly seed: DistributionSeed; readonly projection: ProjectionSet; readonly mode: number };
type DescriptionProfile = Omit<DescribeDistributionRequest, "seed"> & { readonly seed: DistributionSeed & { readonly structure: DistributionStructure } };
export type DescriptionServices = { readonly preparation: DistributionDescriptionPreparer; readonly paths: typeof claudeDistributionDescriptionPaths; readonly structure: typeof prepareDistributionStructure; readonly admit: typeof planPreparedRuntimeFiles; readonly rules: Pick<DistributionAssemblyRules, "path"> };
const admitDescriptionProfile = ({ request }: { readonly request: DescribeDistributionRequest }): Outcome<DescriptionProfile> => {
  if (request.seed.binding.harness !== "claude" || request.seed.structure?.kind !== "file-parents" || !request.seed.inputPreparations?.some((preparation) => preparation.kind === "runtime-modules" && preparation.paths.includes(".claude/tools/aidlc-version.ts"))) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "distribution-description", detail: "source-version metadata requires the Claude file-parent profile and source-prepared runtime version module" })] };
  return { status: "ok", value: { ...request, seed: { ...request.seed, structure: request.seed.structure } } };
};
const finalDescriptionPaths = ({ request, services }: { readonly request: DescribeDistributionRequest; readonly services: DescriptionServices }): readonly string[] => [...new Set([...request.seed.files.map((file) => file.path), ...request.projection.resources.map((resource) => resource.path), ...services.paths()])];
const descriptionInventory = ({ request, services }: { readonly request: DescriptionProfile; readonly services: DescriptionServices }): Promise<Outcome<DistributionDescriptionRequest>> => {
  const files = finalDescriptionPaths({ request, services });
  return continuePreparation({ previous: services.structure({ files: files.map((path) => ({ path })), retained: request.seed.directories, mode: request.seed.structure.mode, rules: services.rules }), consume: ({ prepared: directories }) => ({ status: "ok", value: { sourceRoot: request.sourceRoot, root: request.root, basis: request.seed.basis, binding: request.seed.binding, mode: request.mode, files, directories: directories.map((directory) => directory.path) } }) });
};
const retainDescription = ({ request, prepared, services }: { readonly request: DescribeDistributionRequest; readonly prepared: PreparedDistributionDescription; readonly services: DescriptionServices }): Promise<Outcome<DistributionSeed>> => continuePreparation({ previous: services.admit({ candidates: prepared.files, inventory: request.seed, rules: services.rules }), consume: ({ prepared: admitted }) => ({ status: "ok", value: { ...request.seed, files: [...request.seed.files, ...admitted.additions], inputPreparations: [...(request.seed.inputPreparations ?? []), prepared.preparation] } }) });
export const describeDistribution = ({ request, services }: { readonly request: DescribeDistributionRequest; readonly services: DescriptionServices }): Promise<Outcome<DistributionSeed>> => continuePreparation({ previous: admitDescriptionProfile({ request }), consume: ({ prepared: admitted }) => continuePreparation({ previous: descriptionInventory({ request: admitted, services }), consume: ({ prepared: inventory }) => continuePreparation({ previous: services.preparation.prepare(inventory), consume: ({ prepared }) => retainDescription({ request: admitted, prepared, services }) }) }) });
