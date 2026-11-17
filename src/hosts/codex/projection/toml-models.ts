import { modelAgentName, resolveModelPolicy, writeCodexAgentSurface } from "../../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { Tier } from "../../../workflow-definition/domain/vocabulary.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { TierFlavor } from "../../../projection/domain/tier-flavor.ts";

export const renderCodexToml = (request: {
  readonly agent: Agent;
  readonly content: string;
  readonly tierFlavor: TierFlavor;
  readonly modelCap: Tier | null;
}): Result<string, ProjectionRefusal> => {
  if (request.agent.model.kind !== "tier") return refused({
    kind: "render-failed", concept: "agent", name: request.agent.slug,
    reason: "This core-agent bridge requires an authored model tier.",
  });
  try {
    const policy = resolveModelPolicy(null, modelAgentName(request.agent.slug), request.agent.model.tier,
      request.tierFlavor, request.modelCap);
    return accepted(writeCodexAgentSurface(request.content, policy));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.agent.slug,
      reason: error instanceof Error ? error.message : String(error) });
  }
};
