import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { HostAgentRenderer } from "../../../projection/application/ports/agents.ts";

export const claudeAgents: HostAgentRenderer = (inputs) => ({
  renderAgent: ({ agent }) => {
    const path = projectPath(`.claude/agents/${agent.slug}.md`);
    if (!path.ok) return refused({ kind: "render-failed", concept: "agent", name: agent.slug,
      reason: "The native agent destination must be a project-relative path." });
    const rendered = inputs.documents({ agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
      frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
        removeKeys: [], afterProjectionLines: [] } });
    return rendered.ok ? accepted([{ path: path.value,
      content: { kind: "text", text: rendered.value }, mode: "regular",
      origin: { kind: "method-source", path: agent.source }, availability: "always",
    }]) : rendered;
  },
  renderConductorAgent: () => accepted([]),
});
