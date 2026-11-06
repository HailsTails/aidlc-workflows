import { bindPluginRoleAgent, type PluginRoleContract, type RoleActorSource } from "../src/domain/plugin-role-contract.ts";
import { projectAgentDefinition } from "./agent-projection.ts";
import type { AgentDefinitionProjection } from "../src/application/surface-projection.ts";
import type { AgentProjection } from "../src/domain/agent-definition.ts";
import type { Outcome } from "../src/domain/model.ts";
export const projectAgentFromPluginRoles = ({ contract, actor, ...projection }: Omit<AgentDefinitionProjection, "agent" | "stages"> & { readonly contract: PluginRoleContract; readonly actor: RoleActorSource }): Outcome<AgentProjection> => {
  const bound = bindPluginRoleAgent({ contract, actor });
  return bound.status === "invalid" ? bound : projectAgentDefinition({ ...projection, agent: actor.agent, stages: bound.value });
};
