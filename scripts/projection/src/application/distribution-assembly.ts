import type { ProjectionSet } from "./projection-set.ts";
import type { SourceOrigin } from "../domain/source-origin.ts";
import { distributionMetadataPaths, distributionDirectoryFindings, type DistributionSeed, type AssembledDistribution } from "../domain/distribution-artifact.ts";
export { distributionMetadataPaths } from "../domain/distribution-artifact.ts";
export type { DistributionFile, DistributionDirectory, DistributionSeed, AssembledDistribution } from "../domain/distribution-artifact.ts";
import { finding, type pathStatus, sourceKey, type Finding, type Outcome } from "../domain/model.ts";
import { prepareDistributionStructure } from "../domain/distribution-structure.ts";
import type { DistributionFile, DistributionDirectory } from "../domain/distribution-artifact.ts";

export type DistributionAssemblyRules = { readonly path: typeof pathStatus; readonly encode: (input: { readonly text: string }) => Uint8Array };
export type DistributionAssembler = { readonly assemble: (input: { readonly seed: DistributionSeed; readonly projection: ProjectionSet }) => Outcome<AssembledDistribution> };
const origins = ({ projection }: { readonly projection: ProjectionSet }): readonly SourceOrigin[] => projection.units.flatMap((unit) => unit.kind === "runners" ? unit.projection.runners.map((runner) => runner.compiler) : [unit.projection.origin, ...(unit.kind === "harness-document" ? unit.projection.authoring : [])]);
const assemblyFindings = ({ seed, projection, rules }: { readonly seed: DistributionSeed; readonly projection: ProjectionSet; readonly rules: DistributionAssemblyRules }): readonly Finding[] => [
  ...distributionDirectoryFindings({ directories: seed.directories, files: seed.files, path: rules.path }),
  ...(seed.binding.harness !== projection.target.harness || seed.binding.directory !== projection.target.directory ? [finding({ code: "harness-mismatch", subject: "distribution", detail: "selected projection and seed must describe the same harness binding" })] : []),
  ...origins({ projection }).filter((origin) => sourceKey(origin.source) !== sourceKey(seed.basis.source) || origin.pin !== seed.basis.pin).map((origin) => finding({ code: "foreign-content", subject: origin.path, detail: "seeded core assembly requires selected sources and compiler to match the seed's source basis" })),
  ...projection.units.flatMap((unit) => unit.kind === "runners" ? unit.projection.runners.filter((runner) => sourceKey(runner.owner) !== sourceKey(seed.basis.source)).map((runner) => finding({ code: "foreign-content", subject: runner.entrypoint, detail: "runner owner has no declared source basis in this core distribution seed" })) : []),
  ...seed.files.flatMap((file, index) => [
    ...(rules.path({ path: file.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: file.path, detail: "distribution seed paths must be safe relative files" })] : []),
    ...(seed.files.findIndex((candidate) => candidate.path === file.path) !== index ? [finding({ code: "destination-collision", subject: file.path, detail: "distribution seed paths must be unique" })] : []),
  ]),
  ...distributionMetadataPaths({ binding: seed.binding }).filter((path) => !seed.files.some((file) => file.path === path)).map((path) => finding({ code: "invalid-input", subject: path, detail: "complete distribution seed requires the existing descriptor, stamp and harness metadata" })),
  ...projection.resources.flatMap((resource, index) => [
    ...(seed.directories.some((directory) => directory.path === resource.path) ? [finding({ code: "destination-collision", subject: resource.path, detail: "a native file cannot replace a retained distribution directory" })] : []),
    ...(resource.kind !== "file" || rules.path({ path: resource.path }) === "unsafe" ? [finding({ code: "invalid-destination", subject: resource.path, detail: "seeded assembly accepts safe complete files only" })] : []),
    ...(projection.resources.findIndex((candidate) => candidate.path === resource.path) !== index ? [finding({ code: "destination-collision", subject: resource.path, detail: "each replacement must have one owner" })] : []),
    ...(!seed.files.some((file) => file.path === resource.path) ? [finding({ code: "capability-gap", subject: resource.path, detail: "adding a new distribution path requires an explicit ownership contribution; this seeded assembly only replaces existing paths" })] : []),
    ...(distributionMetadataPaths({ binding: seed.binding }).includes(resource.path) ? [finding({ code: "capability-gap", subject: resource.path, detail: "projection metadata belongs to the distribution producer and cannot be replaced as a native surface" })] : []),
  ]),
  ...(projection.resources.length === 0 ? [finding({ code: "empty-integration", subject: "distribution", detail: "select at least one native replacement" })] : []),
];
const completeAssembly = ({ seed, projection, files, directories }: { readonly seed: DistributionSeed; readonly projection: ProjectionSet; readonly files: readonly DistributionFile[]; readonly directories: readonly DistributionDirectory[] }): AssembledDistribution => ({
  seed: seed.basis,
  binding: seed.binding,
  files,
  directories,
  replaced: projection.resources.map((resource) => resource.path),
  retained: seed.files.filter((file) => !projection.resources.some((resource) => resource.path === file.path)).map((file) => file.path),
  ...(seed.structure === undefined ? {} : { structure: seed.structure }),
});
const finishAssembly = ({ seed, projection, files, rules, structure }: { readonly seed: DistributionSeed; readonly projection: ProjectionSet; readonly files: readonly DistributionFile[]; readonly rules: DistributionAssemblyRules; readonly structure: typeof prepareDistributionStructure }): Outcome<AssembledDistribution> => {
  const directories = seed.structure === undefined ? { status: "ok" as const, value: seed.directories } : structure({ files, retained: seed.directories, mode: seed.structure.mode, rules: { path: rules.path } });
  return directories.status === "invalid" ? directories : { status: "ok", value: completeAssembly({ seed, projection, files, directories: directories.value }) };
};
export const createDistributionAssembler = ({ rules, structure = prepareDistributionStructure }: { readonly rules: DistributionAssemblyRules; readonly structure?: typeof prepareDistributionStructure }): DistributionAssembler => ({
  assemble: ({ seed, projection }) => {
    const findings = assemblyFindings({ seed, projection, rules });
    if (findings.length > 0) return { status: "invalid", findings };
    const files = seed.files.map((file) => { const replacement = projection.resources.find((resource) => resource.path === file.path); return replacement === undefined ? file : { ...file, bytes: rules.encode({ text: replacement.body }) }; });
    return finishAssembly({ seed, projection, files, rules, structure });
  },
});
