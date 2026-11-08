import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness } from "../../../projection/application/ports.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";

type ModelSurface = Result<string, ProjectionRefusal>;
type CodexAgentLegacy = {
  readonly markdownSurface: (agent: Agent) => ModelSurface;
  readonly codexSurface: (request: { readonly agent: Agent; readonly content: string }) => ModelSurface;
  readonly preparePersona: (agent: Agent) => string;
};

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

export const createCodexAgentRenderer = (legacy: CodexAgentLegacy): Harness["renderAgent"] =>
  ({ agent }) => {
    const markdownPath = projectPath(`.codex/agents/${agent.slug}.md`);
    const codexPath = projectPath(`.codex/agents/${agent.slug}.toml`);
    if (!markdownPath.ok || !codexPath.ok) return refused({
      kind: "render-failed", concept: "agent", name: agent.slug,
      reason: "Codex agent destinations must be project-relative paths.",
    });
    const markdown = legacy.markdownSurface(agent);
    if (!markdown.ok) return markdown;
    const codex = legacy.codexSurface({ agent,
      content: nativeRole(agent, legacy.preparePersona(agent)),
    });
    if (!codex.ok) return codex;
    return accepted([
      { path: markdownPath.value, content: { kind: "text", text: markdown.value }, mode: "regular",
        origin: { kind: "method-source", path: agent.source }, availability: "always" },
      { path: codexPath.value, content: { kind: "text", text: codex.value }, mode: "regular",
        origin: { kind: "method-source", path: agent.source }, availability: "always" },
    ]);
  };
