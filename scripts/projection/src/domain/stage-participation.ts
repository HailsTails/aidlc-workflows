import type { AuthoredAgent, AgentStage, AgentParticipation } from "./agent-definition.ts";

export const agentStageModes = ["inline", "mob", "delegated", "subagent", "pipeline"] as const;
export type AgentStageMode = typeof agentStageModes[number];
export const agentParticipation = ({ agent, stages }: { readonly agent: AuthoredAgent; readonly stages: readonly AgentStage[] }): readonly AgentParticipation[] =>
  stages.flatMap((stage): readonly AgentParticipation[] => {
    const roles: readonly AgentParticipation["role"][] = [
      ...(stage.lead === agent.name ? ["lead" as const] : []),
      ...(stage.supports.includes(agent.name) ? ["support" as const] : []),
      ...(stage.reviewer === agent.name ? ["reviewer" as const] : []),
    ];
    return roles.map((role) => ({ origin: stage.origin, stage: stage.slug, mode: stage.mode, role }));
  });
