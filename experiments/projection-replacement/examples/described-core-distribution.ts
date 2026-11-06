import { createCoreDocumentDistributionServices, assembleCoreDocumentDistribution } from "./core-document-distribution.ts";
import { createWorkflowDistributionServices, type WorkflowDistributionServices } from "./workflow-distribution.ts";
import { createSourceDescriptionPreparer } from "../src/adapters/source-distribution-description.ts";
import { claudeDistributionDescriptionPaths } from "../src/domain/distribution-description.ts";
import { prepareDistributionStructure } from "../src/domain/distribution-structure.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
import type { DescriptionServices } from "../src/application/describe-distribution.ts";
export const createCoreDescriptionServices = ({ rules, preparation = createSourceDescriptionPreparer }: { readonly rules: DescriptionServices["rules"]; readonly preparation?: typeof createSourceDescriptionPreparer }): DescriptionServices => ({ preparation: preparation(), paths: claudeDistributionDescriptionPaths, structure: prepareDistributionStructure, admit: planPreparedRuntimeFiles, rules });
export const createDescribedCoreDistributionServices = ({ workflow = createWorkflowDistributionServices, core = createCoreDocumentDistributionServices, description = createCoreDescriptionServices, assemble = assembleCoreDocumentDistribution }: { readonly workflow?: typeof createWorkflowDistributionServices; readonly core?: typeof createCoreDocumentDistributionServices; readonly description?: typeof createCoreDescriptionServices; readonly assemble?: typeof assembleCoreDocumentDistribution } = {}): WorkflowDistributionServices => ({ ...workflow(), assemble: (request) => {
  const services = core();
  return assemble({ ...request, services: { ...services, description: description({ rules: services.rules }) } });
} });
