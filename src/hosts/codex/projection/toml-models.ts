import { isModelHarness, modelAgentName, resolveModelPolicy, writeCodexAgentSurface } from "../../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { Tier } from "../../../workflow-definition/domain/vocabulary.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

export const renderCodexToml = (request: {
  readonly agent: Agent;
  readonly content: string;
  readonly host: HostIdentity;
  readonly modelCap: Tier | null;
}): Result<string, ProjectionRefusal> => {
  if (!isModelHarness(request.host.distribution)) return refused({
    kind: "render-failed", concept: "agent", name: request.agent.slug,
    reason: `The frozen model policy has no host ${request.host.distribution}.`,
  });
  if (request.agent.model.kind !== "tier") return refused({
    kind: "render-failed", concept: "agent", name: request.agent.slug,
    reason: "This core-agent bridge requires an authored model tier.",
  });
  try {
    const policy = resolveModelPolicy(null, modelAgentName(request.agent.slug), request.agent.model.tier,
      request.host.distribution, request.modelCap);
    return accepted(writeCodexAgentSurface(request.content, policy));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.agent.slug,
      reason: error instanceof Error ? error.message : String(error) });
  }
};
