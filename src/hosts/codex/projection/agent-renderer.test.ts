import { SCRATCH_AGENT_INPUTS } from "../../../projection/fixtures/scratch-host.fixture.ts";
import { expect, test, mock } from "bun:test";
import { projectPath } from "../../../kernel/values.ts";
import { host } from "../../../kernel/fixtures/values.fixture.ts";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agentSlug } from "../../../workflow-definition/domain/identities.ts";
import { methodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { codexAgents } from "./agent-renderer.ts";

const codex = host({ name: "codex", directory: ".codex" });
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

test("the registered Codex factory supplies exact Markdown and persona requests and writes native TOML", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, host: codex,
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
  });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(accepted([
    { path: accept(projectPath(".codex/agents/aidlc-example-agent.md")), mode: "regular",
      content: { kind: "text", text: "Markdown persona\n" }, origin: { kind: "method-source", path: agent.source } },
    { path: accept(projectPath(".codex/agents/aidlc-example-agent.toml")), mode: "regular",
      content: { kind: "text", text: 'name = "aidlc-example-agent"\n' +
        'description = "An \\"example\\" role"\nmodel_reasoning_effort = "medium"\n' +
        'developer_instructions = """\nPrepared persona\n"""\n' },
      origin: { kind: "method-source", path: agent.source } },
  ]));
});

test("the registered factory keeps native escaping and the prose-only cap", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, host: codex,
    documents: () => accepted("Markdown"),
    persona: () => accepted('Path \\| and """; the `maxTurns: 12` frontmatter above - keep the two numbers in sync'),
  });
  expect(accept(renderer.renderAgent({ agent, knowledge: [] }))[1]?.content).toEqual({ kind: "text",
    text: 'name = "aidlc-example-agent"\n' +
      'description = "An \\"example\\" role"\nmodel_reasoning_effort = "medium"\n' +
      'developer_instructions = """\nPath \\\\| and \\"\\"\\"; ' +
      "the core persona's `maxTurns: 12` cap - Codex TOML personas carry no " +
      "frontmatter and no native per-agent cap key, so this number is " +
      'prose-only here; update it by hand if the authored cap changes\n"""\n' });
});

test("the real factory applies its captured cap through the host TOML owner", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, host: codex, modelCap: "templated",
    documents: () => accepted("Markdown"), persona: () => accepted("Persona") });
  expect(accept(renderer.renderAgent({ agent, knowledge: [] }))[1]?.content).toEqual({ kind: "text",
    text: 'name = "aidlc-example-agent"\ndescription = "An \\"example\\" role"\n' +
      'developer_instructions = """\nPersona\n"""\n' });
});

test("a document refusal prevents persona work without partial files", () => {
  const persona = mock(() => accepted("Unused"));
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, host: codex,
    documents: () => refused(refusal), persona });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
  expect(persona).not.toHaveBeenCalled();
});

test("a persona refusal is returned before the TOML model writer", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, host: codex,
    documents: () => accepted("Markdown"), persona: () => refused(refusal) });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
});

test("a host model refusal returns no partial Markdown file", () => {
  const renderer = codexAgents({ ...SCRATCH_AGENT_INPUTS, host: host({ name: "unknown", directory: ".unknown" }),
    documents: () => accepted("Markdown"), persona: () => accepted("Persona") });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused({ kind: "render-failed", concept: "agent",
    name: agent.slug, reason: "The frozen model policy has no host unknown." }));
});

test("Codex has no separate conductor agent file", () => {
  expect(codexAgents(SCRATCH_AGENT_INPUTS).renderConductorAgent({ knowledge: [] })).toEqual(accepted([]));
});
