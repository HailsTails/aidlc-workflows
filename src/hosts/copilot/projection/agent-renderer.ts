import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness, Rendering } from "../../../projection/application/ports.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";

export type CopilotModelSurface = (request: {
  readonly agent: Agent;
  readonly removeKeys: readonly string[];
  readonly afterProjectionLines: readonly string[];
}) => Result<string, ProjectionRefusal>;

export const COPILOT_WORKER_TOOLS: readonly string[] = [
  "read",
  "edit",
  "search",
  "execute",
  "web",
  "todo",
];

const SPACE_MEMORY = "aidlc/spaces/<active-space>/memory/";

const ACTIVE_MEMORY = "aidlc/active-memory/";

type TaskDenial = "none" | "task-only" | "other";

const taskDenial = (agent: Agent): TaskDenial => {
  const { disallowed } = agent.tools;
  if (disallowed.length === 0) {
    return "none";
  }
  return disallowed.length === 1 && /^task$/i.test(disallowed[0]?.trim() ?? "")
    ? "task-only"
    : "other";
};

const renderFailed = (agent: Agent, reason: string): ProjectionRefusal => ({
  kind: "render-failed",
  concept: "agent",
  name: agent.slug,
  reason,
});

const workerTools = (denial: TaskDenial): readonly string[] =>
  denial === "task-only"
    ? [`tools: [${COPILOT_WORKER_TOOLS.map((tool) => `"${tool}"`).join(", ")}]`]
    : [];

const placed = (agent: Agent, text: string): Rendering => {
  const path = projectPath(`.github/agents/${agent.slug}.md`);
  return path.ok
    ? accepted([
        {
          path: path.value,
          content: { kind: "text", text: text.replaceAll(SPACE_MEMORY, ACTIVE_MEMORY) },
          mode: "regular",
          origin: { kind: "method-source", path: agent.source },
          availability: "always",
        },
      ])
    : refused(renderFailed(agent, "The Copilot agent destination must be a project-relative path."));
};

export const copilotAgentRenderer =
  (modelSurface: CopilotModelSurface): Harness["renderAgent"] =>
  ({ agent }) => {
    const denial = taskDenial(agent);
    if (denial === "other") {
      return refused(
        renderFailed(
          agent,
          `Copilot can only project a Task denial, not: ${agent.tools.disallowed.join(", ")}.`,
        ),
      );
    }
    const surfaced = modelSurface({
      agent,
      removeKeys: ["disallowedTools"],
      afterProjectionLines: workerTools(denial),
    });
    return surfaced.ok ? placed(agent, surfaced.value) : surfaced;
  };
