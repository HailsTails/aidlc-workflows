import { sharedKnowledgeSources, type SharedKnowledge } from "../../../workflow-definition/domain/knowledge.ts";

export const sharedKnowledgeResources = (knowledge: SharedKnowledge): readonly string[] =>
  sharedKnowledgeSources(knowledge).map((path) => `file://.kiro/${path}`);