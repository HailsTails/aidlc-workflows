import { createWorkflowPublicationReader, type WorkflowPublicationReader } from "../src/adapters/workflow-publication-input.ts";
import { createSourceAssemblyReporter, type SourceAssemblyReporter } from "../src/adapters/source-assembly-reporter.ts";
import { createWorkflowPublicationServices, publishInitialWorkflow, formatWorkflowPublication } from "./publish-workflow.ts";
export type WorkflowBuildDependencies = { readonly reader: WorkflowPublicationReader; readonly services: typeof createWorkflowPublicationServices; readonly publish: typeof publishInitialWorkflow; readonly format: typeof formatWorkflowPublication; readonly reporter: SourceAssemblyReporter };
export const createWorkflowBuildDependencies = (): WorkflowBuildDependencies => ({ reader: createWorkflowPublicationReader(), services: createWorkflowPublicationServices, publish: publishInitialWorkflow, format: formatWorkflowPublication, reporter: createSourceAssemblyReporter() });
export const buildWorkflow = async ({ argv, dependencies = createWorkflowBuildDependencies() }: { readonly argv: readonly string[]; readonly dependencies?: WorkflowBuildDependencies }): Promise<void> => {
  const loaded = await dependencies.reader.load({ argv });
  if (loaded.status === "invalid") return dependencies.reporter.finish({ outcome: loaded });
  const published = await dependencies.publish({ request: loaded.value, services: dependencies.services({ request: loaded.value }) });
  dependencies.reporter.finish({ outcome: published.status === "invalid" ? published : { status: "ok", value: dependencies.format({ published: published.value, publicationPath: loaded.value.publicationPath }) } });
};
if (import.meta.main) await buildWorkflow({ argv: Bun.argv.slice(2) });
