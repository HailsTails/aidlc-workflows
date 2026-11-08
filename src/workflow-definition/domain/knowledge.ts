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
