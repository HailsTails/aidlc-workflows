import { createWorkflowSourceCompiler } from "../src/adapters/workflow-source-compiler.ts";
import { parseCompiledAgentStages } from "../src/adapters/compiled-agent-stages.ts";
import type { WorkflowSourceCompiler, WorkflowSourceLocation, CompiledWorkflowSource } from "../src/domain/workflow-compilation.ts";
import type { CompiledAgentStageCatalogue } from "../src/domain/compiled-agent-stages.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { Outcome } from "../src/domain/model.ts";
export type SourceWorkflowCatalogue = { readonly workflow: CompiledWorkflowSource; readonly catalogue: CompiledAgentStageCatalogue };
export const compileSourceWorkflowCatalogue = ({ location, sources, compiler = createWorkflowSourceCompiler(), parse = parseCompiledAgentStages }: { readonly location: WorkflowSourceLocation; readonly sources: readonly SourceBasis[]; readonly compiler?: WorkflowSourceCompiler; readonly parse?: typeof parseCompiledAgentStages }): Outcome<SourceWorkflowCatalogue> => {
  const compiled = compiler.compile({ location });
  if (compiled.status === "invalid") return compiled;
  const catalogue = parse({ text: compiled.value.graph.text, artifact: compiled.value.graph.origin, binding: compiled.value.binding, sources });
  return catalogue.status === "invalid" ? catalogue : { status: "ok", value: { workflow: compiled.value, catalogue: catalogue.value } };
};
