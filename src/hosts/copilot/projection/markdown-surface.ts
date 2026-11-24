import { writeMarkdownAgentSurface } from "../../../../core/tools/aidlc-model-policy.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { PreparedAgentDocument } from "../../../projection/domain/agent-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

const COPILOT_WORKER_TOOLS = ["read", "edit", "search", "execute", "web", "todo"] as const;

type CopilotSurface =
  | { readonly kind: "companion" }
  | { readonly kind: "native"; readonly delegation: "worker" | "unrestricted" };

export const renderCopilotMarkdown = (request: {
  readonly document: PreparedAgentDocument; readonly surface: CopilotSurface;
}): Result<string, ProjectionRefusal> => {
  const surface = request.surface;
  try {
    return accepted(writeMarkdownAgentSurface(request.document.content, request.document.model, {
      effortKey: "effort",
      ...(surface.kind === "native" ? { removeKeys: ["disallowedTools"],
        afterProjectionLines: surface.delegation === "worker"
          ? [`tools: [${COPILOT_WORKER_TOOLS.map((tool) => `"${tool}"`).join(", ")}]`] : [] } : {}),
    }));
  } catch (error) {
    return refused({ kind: "render-failed", concept: "agent", name: request.document.agent,
      reason: error instanceof Error ? error.message : String(error) });
  }
};
