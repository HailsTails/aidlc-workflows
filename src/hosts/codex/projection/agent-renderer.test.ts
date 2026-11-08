import { expect, test } from "bun:test";
import { projectPath } from "../../../kernel/values.ts";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agentSlug } from "../../../workflow-definition/domain/identities.ts";
import { methodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { createCodexAgentRenderer } from "./agent-renderer.ts";

const agent: Agent = {
  slug: accept(agentSlug("aidlc-example-agent")),
  source: accept(methodSourcePath({ kind: "agent", within: "aidlc-example-agent.md" })),
  displayName: "Example", description: 'An "example"\n role', examples: [],
  owner: { kind: "core" }, model: { kind: "tier", tier: "balanced" },
  tools: { disallowed: ["Task"] }, maxTurns: 12,
  persona: { text: "Persona", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] },
};

const refusal: ProjectionRefusal = { kind: "render-failed", concept: "agent",
  name: agent.slug, reason: "Frozen writer refused" };

test("both native discovery and conductor persona files retain their origins and bytes", () => {
  const renderer = createCodexAgentRenderer({
    markdownSurface: (source) => {
      expect(source).toBe(agent);
      return accepted("Markdown persona\n");
    },
    preparePersona: (source) => {
      expect(source).toBe(agent);
      return " Prepared persona ";
    },
    codexSurface: (request) => {
      expect(request.agent).toBe(agent);
      expect(request.content).toBe('name = "aidlc-example-agent"\n' +
        'description = "An \\"example\\" role"\n' +
        'developer_instructions = """\nPrepared persona\n"""\n');
      return accepted("Native TOML persona\n");
    },
  });
  expect(accept(renderer({ agent, knowledge: [] }))).toEqual([
    { path: accept(projectPath(".codex/agents/aidlc-example-agent.md")), mode: "regular", availability: "always",
      content: { kind: "text", text: "Markdown persona\n" },
      origin: { kind: "method-source", path: agent.source } },
    { path: accept(projectPath(".codex/agents/aidlc-example-agent.toml")), mode: "regular", availability: "always",
      content: { kind: "text", text: "Native TOML persona\n" },
      origin: { kind: "method-source", path: agent.source } },
  ]);
});

test("native instructions escape backslashes and triple quotes and explain the prose-only cap", () => {
  const renderer = createCodexAgentRenderer({
    markdownSurface: () => accepted("Markdown"),
    preparePersona: () => 'Path \\| and """; the `maxTurns: 12` frontmatter above - keep the two numbers in sync',
    codexSurface: (request) => {
      expect(request.content).toBe('name = "aidlc-example-agent"\n' +
        'description = "An \\"example\\" role"\n' +
        'developer_instructions = """\nPath \\\\| and \\"\\"\\"; ' +
        "the core persona's `maxTurns: 12` cap - Codex TOML personas carry no " +
        "frontmatter and no native per-agent cap key, so this number is " +
        'prose-only here; update it by hand if the authored cap changes\n"""\n');
      return accepted("Native");
    },
  });
  expect(renderer({ agent, knowledge: [] }).ok).toBe(true);
});

test("a Markdown model-writer refusal is returned unchanged", () => {
  const renderer = createCodexAgentRenderer({
    markdownSurface: () => refused(refusal),
    codexSurface: () => accepted("Unused"),
    preparePersona: () => "Unused",
  });
  expect(renderer({ agent, knowledge: [] })).toEqual(refused(refusal));
});

test("a TOML model-writer refusal is returned unchanged", () => {
  const renderer = createCodexAgentRenderer({
    markdownSurface: () => accepted("Markdown"),
    codexSurface: () => refused(refusal),
    preparePersona: () => "Persona",
  });
  expect(renderer({ agent, knowledge: [] })).toEqual(refused(refusal));
});
