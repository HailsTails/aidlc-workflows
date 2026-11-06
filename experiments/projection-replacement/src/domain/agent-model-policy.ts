import type { AgentContext, AgentModelChoice } from "./agent-definition.ts";
import type { NativeTier, Tier } from "./model.ts";

const rank: Readonly<Record<Tier, number>> = { templated: 0, balanced: 1, judgment: 2 };
export const resolveAgentModel = ({
  choice,
  context,
}: {
  readonly choice: AgentModelChoice;
  readonly context: AgentContext;
}): NativeTier => {
  if (choice.kind === "explicit")
    return { model: context.models.explicit === "preserve" ? choice.model : null, effort: null };
  const effective = rank[choice.tier] > rank[context.tierCap] ? context.tierCap : choice.tier;
  return { ...context.models.tiers[effective] };
};
