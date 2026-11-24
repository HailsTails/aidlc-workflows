import { writeMarkdownAgentSurface } from "../../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { PreparedAgentDocument } from "../../../projection/domain/agent-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

type OpenCodeSurface =
  | { readonly kind: "companion" }
  | { readonly kind: "subagent"; readonly steps: number | null; readonly delegation: "denied" | "authored" };

export const renderOpenCodeMarkdown = (request: {
  readonly document: PreparedAgentDocument; readonly surface: OpenCodeSurface;
}): Result<string, ProjectionRefusal> => {
  const surface = request.surface;
  try {
    return accepted(writeMarkdownAgentSurface(request.document.content, request.document.model, {
      effortKey: "variant",
      ...(surface.kind === "subagent" ? { removeKeys: ["disallowedTools", "maxTurns"],
        afterProjectionLines: ["mode: subagent", ...(surface.steps === null ? [] : [`steps: ${surface.steps}`]),
          ...(surface.delegation === "denied" ? ["permission:", "  task: deny"] : [])] } : {}),
    }));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.document.agent,
      reason: error instanceof Error ? error.message : String(error) });
  }
};
