import { z } from "zod";
import { isModelHarness, modelAgentName, resolveModelPolicy, serializeAgentTiers, writeKiroCliSurface, writeMarkdownAgentSurface, type EffectiveModelPolicy } from "../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { Tier } from "../../workflow-definition/domain/vocabulary.ts";
import type { Agent } from "../../workflow-definition/domain/agent.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { Result } from "../../kernel/result.ts";
import type { AgentDocumentRequest } from "../application/ports/agents.ts";
import type { AgentModelPolicy } from "../application/ports/agents.ts";
import type { CliModelPolicy } from "../application/ports/settings.ts";

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

const agentSurfacePolicy = (request: {
  readonly host: HostIdentity; readonly agent: Agent; readonly cap: Tier | null;
}): Result<EffectiveModelPolicy, ProjectionRefusal> => {
  if (!isModelHarness(request.host.distribution)) return refused({
    kind: "render-failed", concept: "agent", name: request.agent.slug,
    reason: `The frozen model policy has no host ${request.host.distribution}.`,
  });
  if (request.agent.model.kind !== "tier") return refused({
    kind: "render-failed", concept: "agent", name: request.agent.slug,
    reason: "This core-agent bridge requires an authored model tier.",
  });
  try {
    return accepted(resolveModelPolicy(null, modelAgentName(request.agent.slug), request.agent.model.tier,
      request.host.distribution, request.cap));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.agent.slug,
      reason: error instanceof Error ? error.message : String(error) });
  }
};

export const legacyMarkdownAgentSurface = (binding: { readonly host: HostIdentity; readonly cap: Tier | null }) =>
  (request: Pick<AgentDocumentRequest, "agent" | "frontmatter"> & { readonly content: string }): Result<string, ProjectionRefusal> => {
    const policy = request.frontmatter.model === "omitted" ? accepted({}) : agentSurfacePolicy({ ...binding, agent: request.agent });
    if (!policy.ok) return policy;
    try {
      return accepted(writeMarkdownAgentSurface(request.content, policy.value, {
        effortKey: request.frontmatter.effortKey, quoteModel: request.frontmatter.modelQuoting === "quoted",
        insertBeforeKeys: request.frontmatter.insertBeforeKeys, removeKeys: request.frontmatter.removeKeys,
        afterProjectionLines: request.frontmatter.afterProjectionLines,
      }));
    } catch (error) {
      return refused({ kind: "render-failed", concept: "agent", name: request.agent.slug,
        reason: error instanceof Error ? error.message : String(error) });
    }
  };
