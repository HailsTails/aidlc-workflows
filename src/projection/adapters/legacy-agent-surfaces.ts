import { z } from "zod";
import { isModelHarness, modelAgentName, resolveModelPolicy, serializeAgentTiers, writeKiroCliSurface } from "../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { Tier } from "../../workflow-definition/domain/vocabulary.ts";
import type { AgentModelPolicy, CliModelPolicy } from "../application/ports.ts";

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
