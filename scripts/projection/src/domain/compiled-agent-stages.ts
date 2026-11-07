import type { AuthoredAgent, CompiledAgentStage, AgentStage } from "./agent-definition.ts";
import type { SourceOrigin, SourceBasis } from "./source-origin.ts";
import { finding, sourceKey, type Outcome } from "./model.ts";

export type CompiledAgentStageCatalogue = { readonly artifact: SourceOrigin; readonly sources: readonly SourceBasis[]; readonly stages: readonly CompiledAgentStage[] };
export const bindAgentStageCatalogue = ({ agent, catalogue }: { readonly agent: AuthoredAgent; readonly catalogue: CompiledAgentStageCatalogue }): Outcome<readonly AgentStage[]> => {
  const basis = catalogue.sources.find((entry) => sourceKey(entry.source) === sourceKey(agent.origin.source));
  if (basis === undefined)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: agent.name, detail: "compiled stage catalogue must establish this agent owner's source pin before participation is used" })] };
  if (basis.pin !== agent.origin.pin)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: agent.name, detail: "agent source pin differs from its source basis in the compiled stage catalogue" })] };
  return { status: "ok", value: catalogue.stages };
};
