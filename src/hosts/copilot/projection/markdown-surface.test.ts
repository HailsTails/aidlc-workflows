import { expect, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { agent } from "../../../workflow-definition/fixtures/identities.fixture.ts";
import type { PreparedAgentDocument } from "../../../projection/domain/agent-surface.ts";
import { renderCopilotMarkdown } from "./markdown-surface.ts";

const document: PreparedAgentDocument = { agent: agent("aidlc-example-agent"),
  content: "---\nname: Example\ntier: balanced\nmodel: old\neffort: low\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n",
  model: {} };

test("native worker delegation uses the existing closed tool set with no projected model", () => {
  expect(renderCopilotMarkdown({ document, surface: { kind: "native", delegation: "worker" } }))
    .toEqual(accepted('---\nname: Example\ntools: ["read", "edit", "search", "execute", "web", "todo"]\nmaxTurns: 12\n---\nPersona\n'));
});

test("unrestricted native delegation does not invent an allowlist", () => {
  expect(renderCopilotMarkdown({ document, surface: { kind: "native", delegation: "unrestricted" } }))
    .toEqual(accepted("---\nname: Example\nmaxTurns: 12\n---\nPersona\n"));
});

test("the runtime companion projects its model and retains authored denial and cap", () => {
  expect(renderCopilotMarkdown({ document: { ...document, model: { model: "selected", effort: "high" } },
    surface: { kind: "companion" } })).toEqual(accepted(
    "---\nname: Example\nmodel: selected\neffort: high\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n"));
});

test("malformed frontmatter retains the actual agent refusal", () => {
  expect(renderCopilotMarkdown({ document: { ...document, content: "No frontmatter" },
    surface: { kind: "companion" } })).toEqual(refused({ kind: "render-failed", concept: "agent",
    name: document.agent, reason: "agent markdown has no closed frontmatter block" }));
});
