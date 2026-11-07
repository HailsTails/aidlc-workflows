import { createLegacyRunnerDiscovery } from "../../../../../scripts/projection/src/adapters/legacy-runner-discovery.ts";
import { createNativeRunnerRequirementRules } from "../../../../../scripts/projection/src/adapters/native-runner-requirement-rules.ts";
import { discoverNativeRunnerRequirements, type NativeRunnerRequirements, type NativeRunnerRequirementRules } from "../../../../../scripts/projection/src/application/native-runner-requirements.ts";
import { createDistributionSource, type DistributionSourceLocation, type DistributionSource } from "../../../../../scripts/projection/src/adapters/distribution-source.ts";
import type { DistributionSeed } from "../../../../../scripts/projection/src/domain/distribution-artifact.ts";
import type { RunnerDiscovery } from "../../../../../scripts/projection/src/domain/generated-runner.ts";
import type { Outcome } from "../../../../../scripts/projection/src/domain/model.ts";
import { parseStageDocumentRequirements } from "../src/adapters/compiled-stage-documents.ts";
export type PreparedRunnerRequirements = { readonly seed: DistributionSeed; readonly requirements: NativeRunnerRequirements; readonly stageDocuments: readonly string[] };
export type RunnerRequirementsServices = { readonly source: Pick<DistributionSource, "load">; readonly discover: typeof discoverNativeRunnerRequirements; readonly stages: typeof parseStageDocumentRequirements; readonly rules: NativeRunnerRequirementRules; readonly factory: (input: { readonly location: DistributionSourceLocation; readonly seed: DistributionSeed }) => RunnerDiscovery };
export const createRunnerRequirementsServices = (): RunnerRequirementsServices => ({ source: createDistributionSource(), discover: discoverNativeRunnerRequirements, stages: parseStageDocumentRequirements, rules: createNativeRunnerRequirementRules(), factory: ({ location, seed }) => createLegacyRunnerDiscovery({ runtime: { root: location.root, binding: seed.binding }, compiler: { ...seed.basis, path: "core/tools/aidlc-runner-gen.ts" } }) });
export const prepareRunnerRequirements = async ({ location, services = createRunnerRequirementsServices() }: { readonly location: DistributionSourceLocation; readonly services?: RunnerRequirementsServices }): Promise<Outcome<PreparedRunnerRequirements>> => {
  const loaded = await services.source.load(location);
  if (loaded.status === "invalid") return loaded;
  const requirements = services.discover({ discovery: services.factory({ location, seed: loaded.value }), inputSnapshot: loaded.value, rules: services.rules });
  if (requirements.status === "invalid") return requirements;
  const stages = services.stages({ seed: loaded.value });
  return stages.status === "invalid" ? stages : { status: "ok", value: { seed: loaded.value, requirements: requirements.value, stageDocuments: stages.value } };
};
