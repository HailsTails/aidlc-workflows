import { isModelHarness, modelAgentName, resolveModelPolicy } from "../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { Tier } from "../../workflow-definition/domain/vocabulary.ts";
import type { AgentModelPolicy } from "../application/ports.ts";

export const legacyAgentModelPolicy = (cap: Tier | null): AgentModelPolicy => (request) => {
  if (!isModelHarness(request.host.distribution)) return refused({
    kind: "render-failed", concept: "agent", name: request.agent,
    reason: `The frozen model policy has no host ${request.host.distribution}.`,
  });
  try {
    return accepted(resolveModelPolicy(null, modelAgentName(request.agent), request.model.tier,
      request.host.distribution, cap).model);
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.agent,
      reason: error instanceof Error ? error.message : String(error) });
  }
};