import { kiroKnowledgePreflightClause } from "../../../../core/tools/aidlc-inline-context.ts";
import type { KnowledgeReading } from "../../../projection/application/ports/agents.ts";

export const kiroIdeKnowledgeReading = (directory: string): KnowledgeReading =>
  ({ kind: "in-parts", guide: kiroKnowledgePreflightClause(directory) });
