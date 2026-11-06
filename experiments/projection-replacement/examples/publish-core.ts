import { assembleAuthoredCoreDistribution, createCoreDistributionServices } from "./core-distribution.ts";
import { createPublicationAssembler } from "./publication-assembly.ts";
import { createDescribedCoreDistributionServices } from "./described-core-distribution.ts";
import { createWorkflowPublicationServices, formatWorkflowPublication, type WorkflowPublicationServices, type PublishedWorkflow } from "./publish-workflow.ts";
import type { WorkflowPublicationRequest } from "../src/application/workflow-publication-request.ts";
const corePublicationFactory = ({ request }: { readonly request: WorkflowPublicationRequest }): typeof createCoreDistributionServices => request.distributionMetadata === "prepare-source" ? createDescribedCoreDistributionServices : createCoreDistributionServices;
export const createCorePublicationServices = ({ request, createAssembly = createPublicationAssembler }: { readonly request: WorkflowPublicationRequest; readonly createAssembly?: typeof createPublicationAssembler }): WorkflowPublicationServices => ({ ...createWorkflowPublicationServices({ request }), assemble: createAssembly({ request, assemble: assembleAuthoredCoreDistribution, createServices: corePublicationFactory({ request }) }) });
export const formatCorePublication = ({ published, publicationPath, format = formatWorkflowPublication }: { readonly published: PublishedWorkflow; readonly publicationPath: string; readonly format?: typeof formatWorkflowPublication }): string => format({ published, publicationPath, scope: "core-authored-selected-surfaces" });
