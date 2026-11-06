import type { SourceContentDigest } from "./source-origin.ts";
import type { CompiledWorkflowSource } from "./workflow-compilation.ts";
import { finding, type Outcome } from "./model.ts";
export type WorkflowSourceDirectory = "core/scopes" | "core/aidlc-common/stages";
export const bindWorkflowSourceInputs = ({ inputs, workflow, directory }: { readonly inputs: readonly SourceContentDigest[]; readonly workflow: CompiledWorkflowSource; readonly directory: WorkflowSourceDirectory }): Outcome<readonly SourceContentDigest[]> => {
  const compiled = workflow.inputs.filter((input) => input.path.startsWith(`${directory}/`));
  const label = directory === "core/scopes" ? "scope" : "stage";
  return compiled.length !== inputs.length || compiled.some((input) => !inputs.some((source) => source.path === input.path && source.sha256 === input.sha256)) ? { status: "invalid", findings: [finding({ code: "foreign-content", subject: `${label}-sources`, detail: `authored ${label} inventory and bytes must match the workflow compiler's ${label} witnesses; retry from stable source inputs` })] } : { status: "ok", value: inputs };
};
