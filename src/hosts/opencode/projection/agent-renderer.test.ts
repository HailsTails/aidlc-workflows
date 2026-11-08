import { expect, test } from "bun:test";
import { accept } from "../../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agentSlug } from "../../../workflow-definition/domain/identities.ts";
import { methodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { createOpenCodeAgentRenderer } from "./agent-renderer.ts";

const agent: Agent = {
  slug: accept(agentSlug("aidlc-example-agent")),
  source: accept(methodSourcePath({ kind: "agent", within: "aidlc-example-agent.md" })),
  displayName: "Example", description: "Example role", examples: [],
  owner: { kind: "core" }, model: { kind: "tier", tier: "balanced" },
  tools: { disallowed: ["Task"] }, maxTurns: 12,
  persona: { text: "Budget `maxTurns: 12`", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] },
};

test("native fields are passed to the frozen model surface and the persona names steps", () => {
  const renderer = createOpenCodeAgentRenderer((request) => {
    expect(request.agent).toBe(agent);
    expect(request.effortKey).toBe("variant");
    expect(request.removeKeys).toEqual(["disallowedTools", "maxTurns"]);
    expect(request.afterProjectionLines).toEqual([
      "mode: subagent", "steps: 12", "permission:", "  task: deny",
    ]);
    return accepted("---\nvariant: medium\n---\nBudget `maxTurns: 12`\n");
  });
  const rendering = renderer({ agent, knowledge: [] });
  expect(accept(rendering)).toMatchObject([{
    path: ".opencode/agents/aidlc-example-agent.md", mode: "regular", availability: "always",
    content: { kind: "text", text: "---\nvariant: medium\n---\nBudget `steps: 12`\n" },
    origin: { kind: "method-source", path: agent.source },
  }]);
});

test("an agent without a cap or denials adds only the native subagent mode", () => {
  const renderer = createOpenCodeAgentRenderer((request) => {
    expect(request.afterProjectionLines).toEqual(["mode: subagent"]);
    return accepted("Native model inheritance\n");
  });
  const rendering = renderer({ agent: { ...agent, maxTurns: null, tools: { disallowed: [] } },
    knowledge: [] });
  expect(accept(rendering)).toMatchObject([{ content: { text: "Native model inheritance\n" } }]);
});

test("a denial without Task is refused instead of emitting an unrelated native grant", () => {
  const renderer = createOpenCodeAgentRenderer(() => accepted("Unused"));
  expect(renderer({ agent: { ...agent, tools: { disallowed: ["Read"] } }, knowledge: [] }))
    .toMatchObject({ ok: false, refusal: { kind: "render-failed", concept: "agent",
      name: "aidlc-example-agent" } });
});

test("the existing Task translation also accepts a mixed authored denial list", () => {
  const renderer = createOpenCodeAgentRenderer((request) => {
    expect(request.afterProjectionLines).toEqual([
      "mode: subagent", "steps: 12", "permission:", "  task: deny",
    ]);
    return accepted("Native task denial\n");
  });
  expect(renderer({ agent: { ...agent, tools: { disallowed: ["Read", "task"] } },
    knowledge: [] }).ok).toBe(true);
});

test("a frozen model bridge refusal reaches the caller unchanged", () => {
  const refusal: ProjectionRefusal = { kind: "render-failed", concept: "agent",
    name: agent.slug, reason: "Model policy refused this projection" };
  const renderer = createOpenCodeAgentRenderer(() => refused(refusal));
  expect(renderer({ agent, knowledge: [] })).toEqual(refused(refusal));
});
