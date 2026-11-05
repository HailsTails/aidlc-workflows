import { parseAgentSource } from "../src/adapters/agent-source.ts";
import { createAgentEmitter } from "../src/adapters/agent-emitter.ts";
import type { AgentNativeEmitter } from "../src/domain/agent-native.ts";
import { createAgentPreparation } from "../src/domain/agent-preparation.ts";
import { createAgentRenderer } from "../src/domain/agent-rendering.ts";
import type {
  AgentContext,
  AgentKnowledge,
  AgentOrigin,
  AgentProjection,
  AgentStage,
} from "../src/domain/agent-definition.ts";
import type { Outcome } from "../src/domain/model.ts";

import type { AgentDefinitionProjection } from "../src/application/surface-projection.ts";
export type { AgentDefinitionProjection } from "../src/application/surface-projection.ts";
export const projectAgentDefinition = ({ agent, context, knowledge, stages, emitter }: AgentDefinitionProjection): Outcome<AgentProjection> => {
  const prepared = createAgentPreparation().prepare({ agent, context, knowledge, stages });
  if (prepared.status === "invalid") return prepared;
  return createAgentRenderer({ emitter: emitter ?? createAgentEmitter({ harness: context.harness }) }).render(prepared.value);
};

export const projectAuthoredAgent = ({
  text,
  origin,
  context,
  knowledge,
  stages,
  emitter,
}: {
  readonly text: string;
  readonly origin: AgentOrigin;
  readonly context: AgentContext;
  readonly knowledge: readonly AgentKnowledge[];
  readonly stages: readonly AgentStage[];
  readonly emitter?: AgentNativeEmitter;
}): Outcome<AgentProjection> => {
  const authored = parseAgentSource({ text, origin });
  if (authored.status === "invalid") return authored;
  return projectAgentDefinition({
    agent: authored.value,
    context,
    knowledge,
    stages,
    ...(emitter === undefined ? {} : { emitter }),
  });
};
