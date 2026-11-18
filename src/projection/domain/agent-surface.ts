import type { EffectiveModelPolicy } from "../../../core/tools/aidlc-model-policy.ts";
import type { AgentSlug } from "../../workflow-definition/domain/identities.ts";

export type AgentModelProjection = Readonly<Pick<EffectiveModelPolicy, "model" | "effort">>;

export type PreparedAgentDocument = {
  readonly agent: AgentSlug;
  readonly content: string;
  readonly model: AgentModelProjection;
};
