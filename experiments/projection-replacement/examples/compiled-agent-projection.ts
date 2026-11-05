import { bindAgentStageCatalogue } from "../src/domain/compiled-agent-stages.ts";
import { projectAgentDefinition } from "./agent-projection.ts";
import type { CompiledAgentProjectionRequest } from "../src/application/surface-projection.ts";
import type { AgentProjection } from "../src/domain/agent-definition.ts";
import type { Outcome } from "../src/domain/model.ts";

export const projectAgentFromCompiledStages = ({ catalogue, ...projection }: CompiledAgentProjectionRequest): Outcome<AgentProjection> => {
  const stages = bindAgentStageCatalogue({ agent: projection.agent, catalogue });
  if (stages.status === "invalid") return stages;
  return projectAgentDefinition({ ...projection, stages: stages.value });
};
