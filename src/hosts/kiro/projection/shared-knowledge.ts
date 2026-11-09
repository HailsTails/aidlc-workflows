import type { KnowledgeDocument } from "../../../workflow-definition/domain/knowledge.ts";

const SHARED_DOCUMENT = /^knowledge\/aidlc-shared\/[^/]+\.md$/;

export type SharedKnowledge = {
  readonly documents: readonly KnowledgeDocument[];
  readonly formatDocuments: ReadonlySet<string>;
};

export const sharedKnowledgeResources = (knowledge: SharedKnowledge): readonly string[] =>
  knowledge.documents
    .filter((document) => document.owner.kind === "core" &&
      document.audience.kind === "shared" && SHARED_DOCUMENT.test(document.source))
    .map((document) => document.source)
    .filter((path) => !knowledge.formatDocuments.has(path.split("/").at(-1) ?? ""))
    .sort()
    .map((path) => `file://.kiro/${path}`);
