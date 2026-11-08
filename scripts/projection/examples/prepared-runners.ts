import { createPreparedRunnerInputs, type PreparedRunnerInputs, type PreparedRunnerLocation } from "../src/adapters/prepared-runner-inputs.ts";
import { createLegacyRunnerDiscovery } from "../src/adapters/legacy-runner-discovery.ts";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "../src/adapters/native-compiler-process.ts";
import { createRunnerProcess } from "../src/adapters/runner-process.ts";
import { createNativeRunnerRequirementRules } from "../src/adapters/native-runner-requirement-rules.ts";
import { discoverNativeRunnerRequirements, type NativeRunnerRequirements, type NativeRunnerRequirementRules } from "../src/application/native-runner-requirements.ts";
import { projectGeneratedRunnerDefinitions } from "./generated-runners.ts";
import type { GeneratedRunnerSet } from "../src/application/surface-projection.ts";
import type { RunnerDiscovery, GeneratedRunnerContext, RunnerInputSnapshot } from "../src/domain/generated-runner.ts";
import { finding, type Outcome } from "../src/domain/model.ts";
export type PreparedRunnerCandidates = { readonly inputSnapshot: RunnerInputSnapshot; readonly requirements: NativeRunnerRequirements; readonly projection: GeneratedRunnerSet };
export type PreparedRunnerServices = { readonly source: PreparedRunnerInputs; readonly factory: (input: { readonly location: PreparedRunnerLocation }) => RunnerDiscovery; readonly discover: typeof discoverNativeRunnerRequirements; readonly rules: NativeRunnerRequirementRules; readonly project: typeof projectGeneratedRunnerDefinitions };
export const createPreparedRunnerServices = ({ processes = createNativeCompilerProcessOperations }: { readonly processes?: NativeCompilerProcessFactory } = {}): PreparedRunnerServices => ({ source: createPreparedRunnerInputs(), factory: ({ location }) => createLegacyRunnerDiscovery({ runtime: location, compiler: { ...location.basis, path: "core/tools/aidlc-runner-gen.ts" }, process: createRunnerProcess({ processes }) }), discover: discoverNativeRunnerRequirements, rules: createNativeRunnerRequirementRules(), project: projectGeneratedRunnerDefinitions });
const completeRequirements = ({ requirements }: { readonly requirements: NativeRunnerRequirements }): Outcome<NativeRunnerRequirements> => requirements.scope === "native-generated-runners" ? { status: "ok", value: requirements } : { status: "invalid", findings: [finding({ code: "capability-gap", subject: "prepared-runner-inputs", detail: "producer candidates require complete native generated-runner coverage" })] };
const collectPreparedCandidates = ({ inputSnapshot, requirements, projection }: PreparedRunnerCandidates): Outcome<PreparedRunnerCandidates> => {
  const entrypoints = projection.runners.map((runner) => runner.entrypoint);
  return entrypoints.some((path) => !requirements.paths.includes(path)) || requirements.paths.some((path) => !entrypoints.includes(path)) ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: requirements.skillRoot, detail: "prepared native skill layout is unsupported by the renderer; no candidate files were accepted" })] } : { status: "ok", value: { inputSnapshot, requirements, projection } };
};
export const prepareProducerRunners = async ({ location, context, services = createPreparedRunnerServices() }: { readonly location: PreparedRunnerLocation; readonly context: GeneratedRunnerContext; readonly services?: PreparedRunnerServices }): Promise<Outcome<PreparedRunnerCandidates>> => {
  const inputs = await services.source.load({ location });
  if (inputs.status === "invalid") return inputs;
  const requirements = services.discover({ discovery: services.factory({ location }), inputSnapshot: inputs.value, rules: services.rules });
  if (requirements.status === "invalid") return requirements;
  const complete = completeRequirements({ requirements: requirements.value });
  if (complete.status === "invalid") return complete;
  const projected = services.project({ runners: complete.value.runners, context });
  if (projected.status === "invalid") return projected;
  return collectPreparedCandidates({ inputSnapshot: inputs.value, requirements: complete.value, projection: projected.value });
};
