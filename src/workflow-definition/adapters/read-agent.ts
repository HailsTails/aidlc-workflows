import { refused, type Result } from "../../kernel/result.ts";
import type { MarkdownOutliner } from "../application/ports.ts";
import type { Agent } from "../domain/agent.ts";
import { agentSlug, pluginId } from "../domain/identities.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import { AgentFileSchema } from "./agent-file.ts";
import { authoredValue, decodeMarkdown, translated } from "./authored-markdown.ts";

export const readAgent = (request: {
  readonly source: MethodSourceLocation;
  readonly raw: string;
  readonly outliner: MarkdownOutliner;
}): Result<Agent, readonly MethodRefusal[]> => {
  const { source, raw, outliner } = request;
  const decoded = decodeMarkdown({ source, raw, schema: AgentFileSchema,
    strings: ["name", "display_name", "description", "disallowedTools", "tier", "plugin"] });
  if (!decoded.ok) return decoded;
  const { file, body: authoredText } = decoded.value;
  if (!file.plugin && !file.tier) {
    return refused([{ kind: "core-agent-without-tier", source }]);
  }
  return translated(source, (): Agent => {
    const common = {
      source: source.path, slug: authoredValue(agentSlug(file.name)),
      displayName: file.display_name, description: file.description,
      examples: file.examples ?? [],
      tools: { disallowed: (file.disallowedTools ?? "").split(/[,\s]+/).filter(Boolean) },
      maxTurns: file.maxTurns ?? null, persona: outliner.outline(authoredText),
      additions: { afterPreflight: [], endOfBody: [] },
    };
    if (file.plugin) return { ...common,
      owner: { kind: "plugin", plugin: authoredValue(pluginId(file.plugin)) },
      model: file.tier ? { kind: "tier", tier: file.tier } : { kind: "host-default" },
    };
    if (!file.tier) throw new Error("A core agent needs an explicit tier");
    return { ...common, owner: { kind: "core" }, model: { kind: "tier", tier: file.tier } };
  });
};
