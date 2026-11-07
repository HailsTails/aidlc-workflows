import type {
  AgentContext,
  AgentKnowledge,
  AgentStage,
  AuthoredAgent,
  PreparedAgent,
} from "./agent-definition.ts";
import { prepareAgentKnowledge, prepareAgentPersona } from "./agent-knowledge.ts";
import { agentParticipation } from "./stage-participation.ts";
import { resolveAgentModel } from "./agent-model-policy.ts";
import { resolveAgentPolicy } from "./agent-policy.ts";
import { finding, type Outcome } from "./model.ts";

export type AgentPreparationRules = {
  readonly policy: typeof resolveAgentPolicy;
  readonly persona: typeof prepareAgentPersona;
  readonly knowledge: typeof prepareAgentKnowledge;
  readonly participation: typeof agentParticipation;
  readonly model: typeof resolveAgentModel;
};
export const createAgentPreparationRules = (): AgentPreparationRules => ({
  policy: resolveAgentPolicy,
  persona: prepareAgentPersona,
  knowledge: prepareAgentKnowledge,
  participation: agentParticipation,
  model: resolveAgentModel,
});
export type AgentPreparationInput = {
  readonly agent: AuthoredAgent;
  readonly context: AgentContext;
  readonly knowledge: readonly AgentKnowledge[];
  readonly stages: readonly AgentStage[];
};
export type AgentPreparation = {
  readonly prepare: (input: AgentPreparationInput) => Outcome<PreparedAgent>;
};
const contextFindings = ({ agent, context }: AgentPreparationInput): Outcome<AgentContext> => {
  if (context.invocation.trim().length === 0)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "invalid-invocation",
          subject: agent.name,
          detail: "agent projection requires an invocation",
        }),
      ],
    };
  return { status: "ok", value: context };
};
export const createAgentPreparation = ({
  rules = createAgentPreparationRules(),
}: {
  readonly rules?: AgentPreparationRules;
} = {}): AgentPreparation => ({
  prepare: (input) => {
    const context = contextFindings(input);
    if (context.status === "invalid") return context;
    const policy = rules.policy(input);
    if (policy.status === "invalid") return policy;
    const knowledge = rules.knowledge(input);
    if (knowledge.status === "invalid") return knowledge;
    const nativeModel = rules.model({ choice: input.agent.model, context: input.context });
    const participation = rules.participation(input);
    const personaBody = rules.persona({ agent: input.agent, knowledge: knowledge.value, participation });
    return {
      status: "ok",
      value: {
        agent: input.agent,
        personaBody,
        context: input.context,
        nativeModel,
        knowledge: knowledge.value,
        participation,
      },
    };
  },
});
