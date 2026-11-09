import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness } from "../../../projection/application/ports/harness.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";

export type ClaudeAgentLegacy = (request: {
  readonly agent: Agent;
  readonly effortKey: "effort";
}) => Result<string, ProjectionRefusal>;

export const createClaudeAgentRenderer = (legacyModelSurface: ClaudeAgentLegacy):
  Harness["renderAgent"] => ({ agent }) => {
  const path = projectPath(`.claude/agents/${agent.slug}.md`);
  if (!path.ok) return refused({ kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "The native agent destination must be a project-relative path." });
  const rendered = legacyModelSurface({ agent, effortKey: "effort" });
  return rendered.ok ? accepted([{ path: path.value,
    content: { kind: "text", text: rendered.value }, mode: "regular",
    origin: { kind: "method-source", path: agent.source }, availability: "always",
  }]) : rendered;
};
