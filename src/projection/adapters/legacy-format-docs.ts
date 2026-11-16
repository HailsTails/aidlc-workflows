import {
  kiroKnowledgePreflightClause, SHIPPED_FORMAT_DOCS, sharedKnowledgeWithoutFormatDocs,
} from "../../../core/tools/aidlc-inline-context.ts";
import type { KnowledgeReadingGuides } from "../application/ports/agents.ts";

export const shippedFormatDocuments = (): ReadonlySet<string> => SHIPPED_FORMAT_DOCS;
export const delegatedSharedKnowledge = (directory: string): string => sharedKnowledgeWithoutFormatDocs(directory);
export const knowledgeReadingGuides = (directory: string): KnowledgeReadingGuides => ({
  ["whole-files"]: "",
  ["in-parts"]: kiroKnowledgePreflightClause(directory),
});
