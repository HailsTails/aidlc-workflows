import type { HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import { projectActiveMemoryReferences as projectSharedActiveMemoryReferences } from "../../../projection/domain/active-memory.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";

const projectActiveMemoryReferences = (raw: string): string => projectSharedActiveMemoryReferences(raw)
  .replaceAll(".aidlc/rules/aidlc-org.md", "aidlc/active-memory/org.md")
  .replaceAll(".aidlc/rules/aidlc-team.md", "aidlc/active-memory/team.md")
  .replaceAll(".aidlc/rules/aidlc-project.md", "aidlc/active-memory/project.md")
  .replaceAll(".aidlc/rules/", "aidlc/active-memory/");

export const openCodeAgents: HostAgentRenderer = (inputs) => ({
  renderAgent: ({ agent }) => {
    const unsupported = agent.tools.disallowed.length > 0
      && !agent.tools.disallowed.some((tool) => /\bTask\b/i.test(tool));
    if (unsupported) return refused({ kind: "render-failed", concept: "agent", name: agent.slug,
      reason: `OpenCode cannot translate disallowedTools without Task: ${agent.tools.disallowed.join(", ")}.` });
    const native = inputs.documents({ agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
      frontmatter: { model: "projected", effortKey: "variant", modelQuoting: "plain", insertBeforeKeys: [],
        removeKeys: ["disallowedTools", "maxTurns"], afterProjectionLines: ["mode: subagent",
          ...(agent.maxTurns === null ? [] : [`steps: ${agent.maxTurns}`]),
          ...(agent.tools.disallowed.length > 0 ? ["permission:", "  task: deny"] : []),
        ] } });
    if (!native.ok) return native;
    const nativePath = projectPath(`.opencode/agents/${agent.slug}.md`);
    if (!nativePath.ok) return refused({ kind: "render-failed", concept: "agent", name: agent.slug,
      reason: "The native agent destination must be a project-relative path." });
    const inline = inputs.documents({ agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
      frontmatter: { model: "projected", effortKey: "variant", modelQuoting: "plain", insertBeforeKeys: [],
        removeKeys: [], afterProjectionLines: [] } });
    if (!inline.ok) return inline;
    const inlinePath = projectPath(`.aidlc/agents/${agent.slug}.md`);
    if (!inlinePath.ok) return refused({ kind: "render-failed", concept: "agent", name: agent.slug,
      reason: "The inline agent destination must be a project-relative path." });
    return accepted([
      { path: nativePath.value, content: { kind: "text", text: projectActiveMemoryReferences(native.value)
        .replace(/`maxTurns: (\d+)`/g, "`steps: $1`") }, mode: "regular",
        origin: { kind: "method-source", path: agent.source }, availability: "always" },
      { path: inlinePath.value, content: { kind: "text", text: projectActiveMemoryReferences(inline.value) },
        mode: "regular", origin: { kind: "method-source", path: agent.source }, availability: "always" },
    ]);
  },
  renderConductorAgent: () => accepted([]),
});
