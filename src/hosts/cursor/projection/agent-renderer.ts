import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness } from "../../../projection/application/ports/harness.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";

export type CursorModelSurface = (request: {
  readonly agent: Agent;
}) => Result<string, ProjectionRefusal>;

const SPACE_MEMORY = "aidlc/spaces/<active-space>/memory/";

const ACTIVE_MEMORY = "aidlc/active-memory/";

export const cursorAgentRenderer =
  (modelSurface: CursorModelSurface): Harness["renderAgent"] =>
  ({ agent }) => {
    const surfaced = modelSurface({ agent });
    if (!surfaced.ok) {
      return surfaced;
    }
    const path = projectPath(`.cursor/agents/${agent.slug}.md`);
    return path.ok
      ? accepted([
          {
            path: path.value,
            content: { kind: "text", text: surfaced.value.replaceAll(SPACE_MEMORY, ACTIVE_MEMORY) },
            mode: "regular",
            origin: { kind: "method-source", path: agent.source },
            availability: "always",
          },
        ])
      : refused({
          kind: "render-failed",
          concept: "agent",
          name: agent.slug,
          reason: "The Cursor agent destination must be a project-relative path.",
        });
  };
