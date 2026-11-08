import { createDistributionSource, type DistributionSource, type DistributionSourceLocation } from "../src/adapters/distribution-source.ts";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "../src/adapters/native-compiler-process.ts";
import type { DistributionSeed } from "../src/application/distribution-assembly.ts";
import { prepareProducerRunners, createPreparedRunnerServices, type PreparedRunnerCandidates } from "./prepared-runners.ts";
import { completeProjectionDistribution, createProjectionDistributionServices, type ProjectionDistributionServices, type IssuedProjectionDistribution } from "./projection-distribution.ts";
import type { ProjectionSet } from "../src/application/projection-set.ts";
import type { GeneratedRunnerContext } from "../src/domain/generated-runner.ts";
import { finding, type Outcome } from "../src/domain/model.ts";
export type RunnerDistributionServices = ProjectionDistributionServices & { readonly source: Pick<DistributionSource, "load" | "archive">; readonly finish: typeof completeProjectionDistribution; readonly prepare: (input: { readonly seed: DistributionSeed; readonly location: DistributionSourceLocation; readonly modelInvocation: GeneratedRunnerContext["modelInvocation"] }) => Promise<Outcome<PreparedRunnerCandidates>> };
export type IssuedRunnerDistribution = IssuedProjectionDistribution;
export const createRunnerDistributionServices = ({ processes = createNativeCompilerProcessOperations }: { readonly processes?: NativeCompilerProcessFactory } = {}): RunnerDistributionServices => ({ ...createProjectionDistributionServices(), source: createDistributionSource(), finish: completeProjectionDistribution, prepare: ({ seed, location, modelInvocation }) => prepareProducerRunners({ location: { root: location.root, basis: seed.basis, binding: seed.binding }, context: { ...seed.binding, modelInvocation }, services: { ...createPreparedRunnerServices({ processes }), source: { load: async () => ({ status: "ok", value: seed }) } } }) });
const runnerProjection = ({ seed, prepared, definitions }: { readonly seed: DistributionSeed; readonly prepared: PreparedRunnerCandidates; readonly definitions: ProjectionSet | undefined }): Outcome<ProjectionSet> => {
  if (definitions !== undefined && (definitions.target.harness !== seed.binding.harness || definitions.target.directory !== seed.binding.directory || definitions.units.some((unit) => unit.kind !== "scope" && unit.kind !== "stage"))) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "runner-distribution", detail: "additional authored projection must contain only stage/scope definitions targeting this runtime binding" })] };
  return { status: "ok", value: { scope: "selected-surfaces", target: seed.binding, units: [...(definitions?.units ?? []), { kind: "runners", key: "generated-runners", projection: prepared.projection }], resources: [...(definitions?.resources ?? []), ...prepared.projection.resources] } };
};
export const assembleRunnerDistribution = async ({ location, mode, modelInvocation, definitions, services = createRunnerDistributionServices() }: { readonly location: DistributionSourceLocation; readonly mode: number; readonly modelInvocation: GeneratedRunnerContext["modelInvocation"]; readonly definitions?: ProjectionSet; readonly services?: RunnerDistributionServices }): Promise<Outcome<IssuedRunnerDistribution>> => {
  const loaded = await services.source.load(location);
  if (loaded.status === "invalid") return loaded;
  const prepared = await services.prepare({ seed: loaded.value, location, modelInvocation });
  if (prepared.status === "invalid") return prepared;
  const selected = runnerProjection({ seed: loaded.value, prepared: prepared.value, definitions });
  if (selected.status === "invalid") return selected;
  return services.finish({ sourceRoot: location.sourceRoot, seed: loaded.value, projection: selected.value, mode, services });
};
