import { writeMarkdownAgentSurface } from "../../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { PreparedAgentDocument } from "../../../projection/domain/agent-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

export const renderCodexMarkdown = (document: PreparedAgentDocument): Result<string, ProjectionRefusal> => {
  try {
    return accepted(writeMarkdownAgentSurface(document.content, document.model, {
      effortKey: "effort",
    }));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: document.agent,
      reason: error instanceof Error ? error.message : String(error) });
  }
};
