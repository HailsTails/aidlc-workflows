import type { AuthoredKnowledge } from "./core-knowledge-sources.ts";
import { renderAuthoredProse, type AuthoredProseContext } from "./authored-prose.ts";
import type { SourceOrigin } from "./source-origin.ts";
import type { Harness } from "./harness-binding.ts";
import type { NativeResource } from "./native-rendering.ts";
import { finding, type Outcome } from "./model.ts";
export type KnowledgeProjection = { readonly origin: SourceOrigin; readonly dependencies?: readonly SourceOrigin[]; readonly harness: Harness; readonly resources: readonly NativeResource[] };
export type KnowledgeProjectionInput = { readonly document: AuthoredKnowledge; readonly context: AuthoredProseContext };
export type KnowledgeProjector = { readonly render: (input: KnowledgeProjectionInput) => Outcome<KnowledgeProjection> };
export const createKnowledgeProjector = ({ prose = renderAuthoredProse }: { readonly prose?: typeof renderAuthoredProse } = {}): KnowledgeProjector => ({ render: ({ document, context }) => {
  if ((!context.invocation.startsWith("bun ") && !(context.harness === "claude" && context.directory === ".claude" && context.invocation === "aidlc"))) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: document.origin.path, detail: "knowledge text requires Bun copy or explicit Claude native context" })] };
  const rendered = prose({ markdown: document.text, context, subject: document.origin.path });
  return rendered.status === "invalid" ? rendered : { status: "ok", value: { origin: document.origin, harness: context.harness, resources: [{ kind: "file", path: `${context.directory}/knowledge/${document.relativePath}`, body: rendered.value }] } };
} });
export const renderKnowledgeDefinition = createKnowledgeProjector().render;
