import { buildWorkflow, createWorkflowBuildDependencies, type WorkflowBuildDependencies } from "./build-workflow.ts";
import { createWorkflowPublicationReader } from "../src/adapters/workflow-publication-input.ts";
import { createCorePublicationServices, formatCorePublication } from "./publish-core.ts";
export const createCoreBuildDependencies = (): WorkflowBuildDependencies => ({ ...createWorkflowBuildDependencies(), reader: createWorkflowPublicationReader({ command: "build:core" }), services: createCorePublicationServices, format: formatCorePublication });
export const buildCore = ({ argv, dependencies = createCoreBuildDependencies(), build = buildWorkflow }: { readonly argv: readonly string[]; readonly dependencies?: WorkflowBuildDependencies; readonly build?: typeof buildWorkflow }): Promise<void> => build({ argv, dependencies });
if (import.meta.main) await buildCore({ argv: Bun.argv.slice(2) });
