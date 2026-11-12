import { SCRATCH_AGENT_INPUTS } from "../../../projection/fixtures/scratch-host.fixture.ts";
import { expect, test, mock } from "bun:test";
import { projectPath } from "../../../kernel/values.ts";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agentSlug } from "../../../workflow-definition/domain/identities.ts";
import { methodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { codexAgents } from "./agent-renderer.ts";

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

test("the registered Codex factory supplies separate exact Markdown and persona requests", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS,
    documents: (request) => {
      expect(request).toEqual({ agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
        frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
          removeKeys: [], afterProjectionLines: [] } });
      return accepted("Markdown persona\n");
    },
    persona: (request) => {
      expect(request).toEqual({ agent, text: "persona-body", knowledge: "absorbed", reading: "whole-files" });
      return accepted(" Prepared persona ");
    },
    tomlModels: (request) => {
      expect(request).toEqual({ agent, content: 'name = "aidlc-example-agent"\n' +
        'description = "An \\"example\\" role"\n' +
        'developer_instructions = """\nPrepared persona\n"""\n' });
      return accepted("Native TOML persona\n");
    },
  });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(accepted([
    { path: accept(projectPath(".codex/agents/aidlc-example-agent.md")), mode: "regular",
      content: { kind: "text", text: "Markdown persona\n" }, origin: { kind: "method-source", path: agent.source } },
    { path: accept(projectPath(".codex/agents/aidlc-example-agent.toml")), mode: "regular",
      content: { kind: "text", text: "Native TOML persona\n" }, origin: { kind: "method-source", path: agent.source } },
  ]));
});

test("the registered factory keeps native escaping and the prose-only cap", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS,
    documents: () => accepted("Markdown"),
    persona: () => accepted('Path \\| and """; the `maxTurns: 12` frontmatter above - keep the two numbers in sync'),
    tomlModels: (request) => {
      expect(request.content).toBe('name = "aidlc-example-agent"\n' +
        'description = "An \\"example\\" role"\n' +
        'developer_instructions = """\nPath \\\\| and \\"\\"\\"; ' +
        "the core persona's `maxTurns: 12` cap - Codex TOML personas carry no " +
        "frontmatter and no native per-agent cap key, so this number is " +
        'prose-only here; update it by hand if the authored cap changes\n"""\n');
      return accepted("Native");
    },
  });
  expect(renderer.renderAgent({ agent, knowledge: [] }).ok).toBe(true);
});

test("a document refusal prevents persona and TOML work without partial files", () => {
  const persona = mock(() => accepted("Unused"));
  const tomlModels = mock(() => accepted("Unused"));
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, documents: () => refused(refusal), persona, tomlModels });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
  expect(persona).not.toHaveBeenCalled();
  expect(tomlModels).not.toHaveBeenCalled();
});

test("a persona refusal is returned before the TOML model writer", () => {
  const tomlModels = mock(() => accepted("Unused"));
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, documents: () => accepted("Markdown"),
    persona: () => refused(refusal), tomlModels });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
  expect(tomlModels).not.toHaveBeenCalled();
});

test("a TOML model refusal returns no partial Markdown file", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, documents: () => accepted("Markdown"),
    persona: () => accepted("Persona"), tomlModels: () => refused(refusal) });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
});

test("Codex has no separate conductor agent file", () => {
  expect(codexAgents(SCRATCH_AGENT_INPUTS).renderConductorAgent({ knowledge: [] })).toEqual(accepted([]));
});
