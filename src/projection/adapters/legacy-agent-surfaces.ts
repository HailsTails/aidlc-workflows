import { z } from "zod";
import { modelAgentName, resolveModelPolicy, serializeAgentTiers, writeKiroCliSurface, type EffectiveModelPolicy } from "../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { Tier } from "../../workflow-definition/domain/vocabulary.ts";
import type { Agent } from "../../workflow-definition/domain/agent.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { TierFlavor } from "../domain/tier-flavor.ts";
import type { Result } from "../../kernel/result.ts";
import type { AgentDocumentRequest } from "../application/ports/agents.ts";
import type { AgentModelPolicy } from "../application/ports/agents.ts";
import type { CliModelPolicy } from "../application/ports/settings.ts";
import type { AgentModelProjection } from "../domain/agent-surface.ts";

type FlavoredPolicy = { readonly flavor: TierFlavor; readonly cap: Tier | null };

export const legacyAgentModelPolicy = ({ flavor, cap }: FlavoredPolicy): AgentModelPolicy => (request) => {
  try {
    return accepted(resolveModelPolicy(null, modelAgentName(request.agent), request.model.tier,
      flavor, cap).model);
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.agent,
      reason: error instanceof Error ? error.message : String(error) });
  }
};
export const legacyAgentTiersData = (method: Method): FileContent => ({ kind: "text",
  text: serializeAgentTiers(Object.fromEntries(method.agents.flatMap((agent) =>
    agent.owner.kind === "core" && agent.model.kind === "tier"
      ? [[modelAgentName(agent.slug), agent.model.tier]] : []))),
});

export const legacyCliModelPolicy = (cap: Tier | null): CliModelPolicy => (file) => {
  const text = file.content.kind === "text" ? file.content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.content.bytes);
  try {
    const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(text));
    if (!parsed.success) return refused({
      kind: "render-failed", concept: "settings", name: file.source,
      reason: "The CLI settings file must contain a JSON object.",
    });
    return accepted({ source: file.source,
      content: { kind: "text", text: writeKiroCliSurface(text, [], cap) } });
  } catch (error) {
    return refused({ kind: "render-failed", concept: "settings", name: file.source,
      reason: error instanceof Error ? error.message : String(error) });
  }
};

const agentSurfacePolicy = (request: FlavoredPolicy & {
  readonly agent: Agent;
}): Result<EffectiveModelPolicy, ProjectionRefusal> => {
  if (request.agent.model.kind !== "tier") return refused({
    kind: "render-failed", concept: "agent", name: request.agent.slug,
    reason: "This core-agent bridge requires an authored model tier.",
  });
  try {
    return accepted(resolveModelPolicy(null, modelAgentName(request.agent.slug), request.agent.model.tier,
      request.flavor, request.cap));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.agent.slug,
      reason: error instanceof Error ? error.message : String(error) });
  }
};

export const legacyAgentDocumentModel = (binding: FlavoredPolicy) =>
  (request: Pick<AgentDocumentRequest, "agent" | "model">): Result<AgentModelProjection, ProjectionRefusal> => {
    if (request.model === "omitted") return accepted({});
    const policy = agentSurfacePolicy({ ...binding, agent: request.agent });
    return policy.ok ? accepted({
      ...(policy.value.model === undefined ? {} : { model: policy.value.model }),
      ...(policy.value.effort === undefined ? {} : { effort: policy.value.effort }),
    }) : policy;
  };
