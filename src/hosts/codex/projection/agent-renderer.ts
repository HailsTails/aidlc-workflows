import type { HostAgentRenderer } from "../../../projection/application/ports/agents.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";

const nativeInstructions = (persona: string): string => persona.replace(
  /the `maxTurns: (\d+)` frontmatter above - keep the two numbers in sync/g,
  "the core persona's `maxTurns: $1` cap - Codex TOML personas carry no " +
    "frontmatter and no native per-agent cap key, so this number is " +
    "prose-only here; update it by hand if the authored cap changes",
).trim().replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');

const nativeRole = (agent: Agent, persona: string): string =>
  `name = "${agent.slug}"\n` +
  `description = "${agent.description.replace(/\s+/g, " ").trim().replace(/"/g, '\\"')}"\n` +
  `developer_instructions = """\n${nativeInstructions(persona)}\n"""\n`;

export const codexAgents: HostAgentRenderer = (inputs) => ({
  renderAgent: ({ agent }) => {
    const markdownPath = projectPath(`.codex/agents/${agent.slug}.md`);
    const codexPath = projectPath(`.codex/agents/${agent.slug}.toml`);
    if (!markdownPath.ok || !codexPath.ok) return refused({
      kind: "render-failed", concept: "agent", name: agent.slug,
      reason: "Codex agent destinations must be project-relative paths.",
    });
    const markdown = inputs.documents({ agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
      frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
        removeKeys: [], afterProjectionLines: [] } });
    if (!markdown.ok) return markdown;
    const persona = inputs.persona({ agent, text: "persona-body", knowledge: "absorbed", reading: "whole-files" });
    if (!persona.ok) return persona;
    const codex = inputs.tomlModels({ agent, content: nativeRole(agent, persona.value) });
    if (!codex.ok) return codex;
    return accepted([
      { path: markdownPath.value, content: { kind: "text", text: markdown.value }, mode: "regular",
        origin: { kind: "method-source", path: agent.source } },
      { path: codexPath.value, content: { kind: "text", text: codex.value }, mode: "regular",
        origin: { kind: "method-source", path: agent.source } },
    ]);
  },
  renderConductorAgent: () => accepted([]),
});
