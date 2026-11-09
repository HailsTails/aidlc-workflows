import type { Result } from "../../../kernel/result.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness } from "../../../projection/application/ports/harness.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";

type LegacyModelSurface = (request: {
  readonly agent: Agent;
  readonly effortKey: "variant";
  readonly removeKeys: readonly string[];
  readonly afterProjectionLines: readonly string[];
}) => Result<string, ProjectionRefusal>;

export const createOpenCodeAgentRenderer = (
  legacyModelSurface: LegacyModelSurface,
): Harness["renderAgent"] => ({ agent }) => {
  const unsupported = agent.tools.disallowed.length > 0
    && !agent.tools.disallowed.some((tool) => /\bTask\b/i.test(tool));
  if (unsupported) return refused({
    kind: "render-failed", concept: "agent", name: agent.slug,
    reason: `OpenCode cannot translate disallowedTools without Task: ${agent.tools.disallowed.join(", ")}.`,
  });
  const rendered = legacyModelSurface({ agent, effortKey: "variant",
    removeKeys: ["disallowedTools", "maxTurns"],
    afterProjectionLines: ["mode: subagent",
      ...(agent.maxTurns === null ? [] : [`steps: ${agent.maxTurns}`]),
      ...(agent.tools.disallowed.length > 0 ? ["permission:", "  task: deny"] : []),
    ],
  });
  if (!rendered.ok) return rendered;
  const path = projectPath(`.opencode/agents/${agent.slug}.md`);
  if (!path.ok) return refused({ kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "The native agent destination must be a project-relative path." });
  return accepted([{ path: path.value,
    content: { kind: "text", text: rendered.value.replace(/`maxTurns: (\d+)`/g, "`steps: $1`") },
    mode: "regular", origin: { kind: "method-source", path: agent.source }, availability: "always",
  }]);
};
