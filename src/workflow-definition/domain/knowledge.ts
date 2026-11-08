import type { RelativePath } from "../../kernel/values.ts";
import type { AgentSlug, Owner } from "./identities.ts";

export type KnowledgeAudience =
  | { readonly kind: "shared" }
  | { readonly kind: "agent"; readonly agent: AgentSlug };

export type KnowledgeDocument = {
  readonly source: RelativePath;
  readonly owner: Owner;
  readonly audience: KnowledgeAudience;
};
