import { SHIPPED_FORMAT_DOCS, sharedKnowledgeWithoutFormatDocs } from "../../../core/tools/aidlc-inline-context.ts";

export const shippedFormatDocuments = (): ReadonlySet<string> => SHIPPED_FORMAT_DOCS;
export const delegatedSharedKnowledge = (directory: string): string => sharedKnowledgeWithoutFormatDocs(directory);
