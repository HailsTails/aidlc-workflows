import { expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { SourcePath } from "../../../kernel/values.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug, PluginId } from "../../../workflow-definition/domain/identities.ts";
import type { KnowledgeDocument } from "../../../workflow-definition/domain/knowledge.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { kiroJsonAgentRenderer } from "./json-agent-renderer.ts";
import { withSharedKnowledge } from "./shared-knowledge.ts";

const agent: Agent = {
  slug: brand<AgentSlug>("aidlc-architect-agent"),
  source: brand<MethodSourcePath>("agents/aidlc-architect-agent.md"),
  displayName: "Architect", description: "Architecture", owner: { kind: "core" },
  model: { kind: "tier", tier: "judgment" }, examples: [],
  tools: { disallowed: ["Task"] }, maxTurns: null,
  persona: { text: "# Architect\n", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] },
};
const file: AuthoredHostFile = {
  source: brand<SourcePath>("agents/aidlc-architect-agent.json"),
  content: { kind: "text", text: '{ "name": "original", "custom": true }\n' },
};
const document = (name: string): KnowledgeDocument => ({
  source: brand<MethodSourcePath>(`knowledge/aidlc-shared/${name}`),
  owner: { kind: "core" }, audience: { kind: "shared" },
});
const documents: readonly KnowledgeDocument[] = [document("z.md"), document("state-template.md"), document("a.md"),
  document("nested/ignored.md"), document("ignored.txt"),
  { ...document("plugin.md"), owner: { kind: "plugin", plugin: brand<PluginId>("test-pro") } }];
const formatDocuments = new Set(["state-template.md"]);
const glob = "file://.kiro/knowledge/aidlc-shared/*.md";

const rendered = (text: string) => kiroJsonAgentRenderer({
  files: [file], formatDocuments, modelSurface: () => accepted(text),
})({ agent, knowledge: documents });

test("persona JSON selects original host input and forwards typed model semantics", () => {
  const surface = mock(() => accepted('{ "name": "modeled" }\n'));
  const rendering = kiroJsonAgentRenderer({ files: [file], formatDocuments, modelSurface: surface })({
    agent, knowledge: [],
  });
  expect(surface).toHaveBeenCalledWith({ agent, file });
  expect(rendering).toMatchObject({ ok: true, value: [{
    path: ".kiro/agents/aidlc-architect-agent.json",
    content: { text: '{ "name": "modeled" }\n' },
    origin: { kind: "harness-authored", source: file.source },
  }] });
});

test("shared glob expands sorted direct core methodology documents in place", () => {
  const text = JSON.stringify({ name: "original", resources: ["before", glob, "after"],
    hooks: { preToolUse: [{ command: "unchanged" }] }, custom: { preserved: true } });
  expect(rendered(text)).toMatchObject({ ok: true, value: [{ content: { text:
    `${JSON.stringify({ name: "original", resources: ["before",
      "file://.kiro/knowledge/aidlc-shared/a.md", "file://.kiro/knowledge/aidlc-shared/z.md", "after"],
      hooks: { preToolUse: [{ command: "unchanged" }] }, custom: { preserved: true } }, null, 2)}\n`,
  } }] });
});

test("unmatched host config emits no JSON and does not fabricate a plugin config", () => {
  const surface = mock(() => accepted("{}"));
  expect(kiroJsonAgentRenderer({ files: [], formatDocuments, modelSurface: surface })({
    agent, knowledge: [],
  })).toEqual(accepted([]));
  expect(surface).not.toHaveBeenCalled();
});

test("agent JSON rendering propagates frozen model refusal", () => {
  const failure = { kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "Missing model tier." } as const;
  expect(kiroJsonAgentRenderer({ files: [file], formatDocuments,
    modelSurface: () => refused(failure) })({ agent, knowledge: [] })).toEqual(refused(failure));
});

test.each(["[]", "null", "malformed"])("invalid agent JSON %s is a refusal", (text) => {
  expect(rendered(text)).toMatchObject({ ok: false, refusal: { concept: "agent" } });
});

test("absence of shared glob preserves all bytes", () => {
  const text = '{  "resources": ["elsewhere"], "unknown": 1 }\r\n';
  expect(withSharedKnowledge(text, { documents, formatDocuments })).toEqual(accepted(text));
});

test("conductor can expand knowledge without persona model projection", () => {
  expect(withSharedKnowledge(JSON.stringify({ name: "aidlc", resources: [glob] }), {
    documents: [], formatDocuments,
  })).toEqual(accepted('{\n  "name": "aidlc",\n  "resources": []\n}\n'));
});
