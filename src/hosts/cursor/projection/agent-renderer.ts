import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { AgentRenderingInputs, HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import type { Harness } from "../../../projection/application/ports/harness.ts";
import { projectActiveMemoryReferences } from "../../../projection/domain/active-memory.ts";

const renderAgent = (inputs: AgentRenderingInputs): Harness["renderAgent"] => ({ agent }) => {
  const surfaced = inputs.documents({
    agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
    frontmatter: {
      model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
      removeKeys: [], afterProjectionLines: [],
    },
  });
  if (!surfaced.ok) return surfaced;
  const path = projectPath(`.cursor/agents/${agent.slug}.md`);
  return path.ok ? accepted([{
    path: path.value, content: { kind: "text", text: projectActiveMemoryReferences(surfaced.value) },
    mode: "regular", origin: { kind: "method-source", path: agent.source },
  }]) : refused({ kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "The Cursor agent destination must be a project-relative path." });
};

export const cursorAgents: HostAgentRenderer = (inputs) => ({
  renderAgent: renderAgent(inputs),
  renderConductorAgent: () => accepted([]),
});
