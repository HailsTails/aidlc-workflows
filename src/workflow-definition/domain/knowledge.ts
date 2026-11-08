import type { FileContent } from "../../kernel/file-content.ts";
import type { SourcePath } from "../../kernel/values.ts";
import type { AgentSlug, Owner } from "./identities.ts";

export type KnowledgeAudience =
  | { readonly kind: "shared" }
  | { readonly kind: "agent"; readonly agent: AgentSlug };

export type KnowledgeDocument = {
  readonly source: SourcePath;
  readonly owner: Owner;
  readonly audience: KnowledgeAudience;
  readonly content: FileContent;
};
