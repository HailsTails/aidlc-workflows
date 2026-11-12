import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agentSlug } from "../../../workflow-definition/domain/identities.ts";
import { methodSource } from "../../../workflow-definition/fixtures/method-source.fixture.ts";
import { SCRATCH_AGENT_INPUTS } from "../../../projection/fixtures/scratch-host.fixture.ts";
import { claudeAgents } from "./agent-renderer.ts";

const agent: Agent = {
  slug: accept(agentSlug("aidlc-example-agent")),
  source: methodSource({ kind: "agent", within: "aidlc-example-agent.md" }),
  displayName: "Example", description: "Example role", examples: [], owner: { kind: "core" },
  model: { kind: "tier", tier: "balanced" }, tools: { disallowed: ["Task"] }, maxTurns: 12,
  persona: { text: "Persona", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};
const markdown = "---\nmodel: sonnet\neffort: high\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n";

test("Claude's native Markdown uses the frozen effort surface without rewriting its persona", () => {
  const renderer = claudeAgents({ ...SCRATCH_AGENT_INPUTS, documents: (request) => {
    expect(request).toEqual({ agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
      frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
        removeKeys: [], afterProjectionLines: [] } });
    return accepted(markdown);
  } });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(accepted([{
    path: path(".claude/agents/aidlc-example-agent.md"),
    content: { kind: "text", text: markdown }, mode: "regular",
    origin: { kind: "method-source", path: agent.source },
  }]));
});

test("a frozen model refusal reaches the build caller without a partial agent file", () => {
  const refusal: ProjectionRefusal = { kind: "render-failed", concept: "agent",
    name: "aidlc-example-agent", reason: "Model policy refused this projection" };
  const renderer = claudeAgents({ ...SCRATCH_AGENT_INPUTS, documents: () => refused(refusal) });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused(refusal));
});

test("Claude has no separate conductor agent file", () => {
  expect(claudeAgents(SCRATCH_AGENT_INPUTS).renderConductorAgent({ knowledge: [] })).toEqual(accepted([]));
});
