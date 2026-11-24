import { expect, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { agent } from "../../../workflow-definition/fixtures/identities.fixture.ts";
import type { PreparedAgentDocument } from "../../../projection/domain/agent-surface.ts";
import { renderKiroIdeMarkdown } from "./markdown-surface.ts";

const document: PreparedAgentDocument = { agent: agent("aidlc-example-agent"),
  content: "---\nname: Example\ntier: balanced\nmodel: old\neffort: low\ndisallowedTools: Task\nmaxTurns: 12\n---\nPersona\n",
  model: { model: "selected", effort: "high" } };

test("the host's model spelling preserves its closed document and authored metadata", () => {
  expect(renderKiroIdeMarkdown(document)).toEqual(accepted("---\nname: Example\nmodel: selected\neffort: high\nmaxTurns: 12\n---\nPersona\n"));
});

test("an omitted or inherited model retains the host's existing normalization", () => {
  expect(renderKiroIdeMarkdown({ ...document, model: {} })).toEqual(accepted("---\nname: Example\nmaxTurns: 12\n---\nPersona\n"));
});

test("the frozen writer's malformed-frontmatter error retains agent identity and bytes", () => {
  expect(renderKiroIdeMarkdown({ ...document, content: "No frontmatter" })).toEqual(refused({
    kind: "render-failed", concept: "agent", name: document.agent,
    reason: "agent markdown has no closed frontmatter block",
  }));
});
