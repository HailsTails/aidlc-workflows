import { kiroKnowledgePreflightClause } from "../../../../core/tools/aidlc-inline-context.ts";
import type { KnowledgeReading } from "../../../projection/application/ports/agents.ts";

export const kiroKnowledgeReading = (directory: string): KnowledgeReading =>
  ({ kind: "in-parts", guide: kiroKnowledgePreflightClause(directory) });
