import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agentSlug } from "../../../workflow-definition/domain/identities.ts";
import { methodSource } from "../../../workflow-definition/fixtures/method-source.fixture.ts";
import { createClaudeAgentRenderer } from "./agent-renderer.ts";

const agent: Agent = {
  slug: accept(agentSlug("aidlc-example-agent")),
  source: methodSource({ kind: "agent", within: "aidlc-example-agent.md" }),
  displayName: "Example", description: "Example role", examples: [], owner: { kind: "core" },
  model: { kind: "tier", tier: "balanced" }, tools: { disallowed: ["Task"] }, maxTurns: 12,
  persona: { text: "Persona", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};
const markdown = "---\nmodel: sonnet\neffort: high\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n";

test("Claude's native Markdown uses the frozen effort surface without rewriting its persona", () => {
  const renderer = createClaudeAgentRenderer((request) => {
    expect(request).toEqual({ agent, effortKey: "effort" });
    return accepted(markdown);
  });
  expect(renderer({ agent, knowledge: [] })).toEqual(accepted([{
    path: path(".claude/agents/aidlc-example-agent.md"),
    content: { kind: "text", text: markdown }, mode: "regular", availability: "always",
    origin: { kind: "method-source", path: agent.source },
  }]));
});

test("a frozen model refusal reaches the build caller without a partial agent file", () => {
  const refusal: ProjectionRefusal = { kind: "render-failed", concept: "agent",
    name: "aidlc-example-agent", reason: "Model policy refused this projection" };
  const renderer = createClaudeAgentRenderer(() => refused(refusal));
  expect(renderer({ agent, knowledge: [] })).toEqual(refused(refusal));
});
