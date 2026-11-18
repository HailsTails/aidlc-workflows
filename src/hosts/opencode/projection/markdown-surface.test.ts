import { expect, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { agent } from "../../../workflow-definition/fixtures/identities.fixture.ts";
import type { PreparedAgentDocument } from "../../../projection/domain/agent-surface.ts";
import { renderOpenCodeMarkdown } from "./markdown-surface.ts";

const document: PreparedAgentDocument = { agent: agent("aidlc-example-agent"),
  content: "---\nname: Example\ntier: balanced\nmodel: old\neffort: low\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n",
  model: { model: "selected", effort: "high" } };

test("native subagent maps role, cap and delegation meaning before serialization", () => {
  expect(renderOpenCodeMarkdown({ document,
    surface: { kind: "subagent", steps: 12, delegation: "denied" } })).toEqual(accepted(
    "---\nname: Example\nmodel: selected\nvariant: high\nmode: subagent\nsteps: 12\npermission:\n  task: deny\n---\nPersona\n"));
});

test("absent native cap and authored delegation omit their native fields", () => {
  expect(renderOpenCodeMarkdown({ document,
    surface: { kind: "subagent", steps: null, delegation: "authored" } })).toEqual(accepted(
    "---\nname: Example\nmodel: selected\nvariant: high\nmode: subagent\n---\nPersona\n"));
});

test("the companion retains its authored cap and delegation independently of native translation", () => {
  expect(renderOpenCodeMarkdown({ document, surface: { kind: "companion" } })).toEqual(accepted(
    "---\nname: Example\nmodel: selected\nvariant: high\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n"));
});

test("malformed frontmatter retains the actual agent refusal", () => {
  expect(renderOpenCodeMarkdown({ document: { ...document, content: "No frontmatter" },
    surface: { kind: "companion" } })).toEqual(refused({ kind: "render-failed", concept: "agent",
    name: document.agent, reason: "agent markdown has no closed frontmatter block" }));
});
