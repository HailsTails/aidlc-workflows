import { assembleWorkflowDistribution, createWorkflowDistributionServices, type WorkflowDistribution, type WorkflowDistributionServices } from "./workflow-distribution.ts";
import { createAuthoredCoreAssembler } from "./core-document-distribution.ts";
import type { DistributionSourceLocation } from "../src/adapters/distribution-source.ts";
import type { HarnessBinding } from "../src/domain/harness-binding.ts";
import type { GeneratedRunnerContext } from "../src/domain/generated-runner.ts";
import { finding, type Outcome } from "../src/domain/model.ts";
export type CoreDistributionRequest = { readonly location: DistributionSourceLocation; readonly binding: HarnessBinding; readonly contextRoot: string; readonly mode: number; readonly modelInvocation: GeneratedRunnerContext["modelInvocation"]; readonly stageDocuments?: "project-authored" | "native-supplied"; readonly workflowReferences?: "native-supplied" | "prepare-compiled"; readonly methodRuntime?: "prepare-authored" | "native-supplied"; readonly services?: WorkflowDistributionServices; readonly assemble?: typeof assembleWorkflowDistribution };
export const createCoreDistributionServices = (): WorkflowDistributionServices => ({ ...createWorkflowDistributionServices(), assemble: createAuthoredCoreAssembler() });
const admitCoreDistributionProfile = ({ binding, modelInvocation, stageDocuments, methodRuntime }: { readonly binding: HarnessBinding; readonly modelInvocation: GeneratedRunnerContext["modelInvocation"]; readonly stageDocuments: "project-authored" | "native-supplied"; readonly methodRuntime: "prepare-authored" | "native-supplied" }): Outcome<null> => binding.harness !== "claude" || modelInvocation !== "native-default" || stageDocuments !== "project-authored" || methodRuntime !== "prepare-authored"
  ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: "authored-core", detail: "the authored Core profile qualifies Claude copy delivery with authored stages, prepared method runtime and native-default invocation; use the workflow profile for retained preparations" })] }
  : { status: "ok", value: null };
export const assembleAuthoredCoreDistribution = ({ stageDocuments = "project-authored", methodRuntime = "prepare-authored", services = createCoreDistributionServices(), assemble = assembleWorkflowDistribution, ...request }: CoreDistributionRequest): Promise<Outcome<WorkflowDistribution>> => {
  const admitted = admitCoreDistributionProfile({ binding: request.binding, modelInvocation: request.modelInvocation, stageDocuments, methodRuntime });
  if (admitted.status === "invalid") return Promise.resolve(admitted);
  return assemble({ ...request, stageDocuments, methodRuntime, services });
};
