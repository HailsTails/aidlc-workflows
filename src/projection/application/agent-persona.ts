import { accepted, refused } from "../../kernel/result.ts";
import type { MethodSource } from "../../workflow-definition/domain/method-source.ts";
import { absorbReviewerKnowledge, injectDelegatedKnowledgePreflight } from "../domain/agent-knowledge.ts";
import { bindTemplateTokens } from "../domain/token-binding.ts";
import type { TokenBindings } from "../domain/template-token.ts";
import type { AgentPersonaPreparer } from "./ports/agents.ts";

export const createAgentPersonaPreparer = (request: {
  readonly sources: readonly MethodSource[];
  readonly reviewerAgents: ReadonlySet<string>;
  readonly directory: string;
  readonly sharedKnowledge: string;
  readonly tokens: TokenBindings;
}): AgentPersonaPreparer => (persona) => {
  let text = persona.agent.persona.text;
  if (persona.text === "authored-file") {
    const captured = request.sources.find((source) => source.path === persona.agent.source
      && source.owner.kind === persona.agent.owner.kind
      && (source.owner.kind === "core" || (persona.agent.owner.kind === "plugin"
        && source.owner.plugin === persona.agent.owner.plugin)));
    if (!captured) return refused({ kind: "render-failed", concept: "agent", name: persona.agent.slug,
      reason: "The accepted agent's authored source was not captured." });
    text = captured.content.kind === "text" ? captured.content.text
      : new TextDecoder("utf-8", { ignoreBOM: true }).decode(captured.content.bytes);
  }
  if (persona.knowledge === "absorbed") text = absorbReviewerKnowledge({ content: text,
    agentName: persona.agent.slug, reviewerAgents: request.reviewerAgents, sources: request.sources });
  text = injectDelegatedKnowledgePreflight({ content: text, agentName: persona.agent.slug,
    directory: request.directory, reading: persona.reading, sharedKnowledge: request.sharedKnowledge });
  return accepted(bindTemplateTokens({ text, tokens: request.tokens,
    selected: ["HARNESS_DIR", "INVOKE", "TOOL_PREFIX", "TRUSTED_NAMESPACE", "OPTION_LETTERS"] }));
};
