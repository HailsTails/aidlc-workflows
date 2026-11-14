import type { AgentSlug, Owner } from "./identities.ts";
import type { MethodSourcePath } from "./method-source.ts";

export type KnowledgeAudience =
  | { readonly kind: "shared" }
  | { readonly kind: "agent"; readonly agent: AgentSlug };

export type KnowledgeDocument = {
  readonly source: MethodSourcePath;
  readonly owner: Owner;
  readonly audience: KnowledgeAudience;
};

const SHARED_DOCUMENT = /^knowledge\/aidlc-shared\/[^/]+\.md$/;

export type SharedKnowledge = {
  readonly documents: readonly KnowledgeDocument[];
  readonly formatDocuments: ReadonlySet<string>;
};

export const sharedKnowledgeSources = (knowledge: SharedKnowledge): readonly MethodSourcePath[] =>
  knowledge.documents
    .filter((document) => document.owner.kind === "core" &&
      document.audience.kind === "shared" && SHARED_DOCUMENT.test(document.source))
    .map((document) => document.source)
    .filter((path) => !knowledge.formatDocuments.has(path.split("/").at(-1) ?? ""))
    .sort();