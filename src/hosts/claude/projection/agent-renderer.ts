import { declareLegacyProducedFile } from "../../../projection/domain/legacy-native-source.ts";
import { renderClaudeMarkdown } from "./markdown-surface.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { HostAgentRenderer } from "../../../projection/application/ports/agents.ts";

export const claudeAgents: HostAgentRenderer = (inputs) => ({
  renderAgent: ({ agent }) => {
    const path = projectPath(`.claude/agents/${agent.slug}.md`);
    if (!path.ok) return refused({ kind: "render-failed", concept: "agent", name: agent.slug,
      reason: "The native agent destination must be a project-relative path." });
    const rendered = inputs.documents({ agent, text: "authored-file", knowledge: "absorbed", reading: { kind: "whole-files" },
      model: "projected", render: renderClaudeMarkdown });
    return rendered.ok ? accepted([declareLegacyProducedFile({ context: inputs.legacyNative, file: { path: path.value,
      content: { kind: "text", text: rendered.value }, mode: "regular",
      origin: { kind: "method-source", path: agent.source },
    } })]) : rendered;
  },
  renderConductorAgent: () => accepted([]),
});
