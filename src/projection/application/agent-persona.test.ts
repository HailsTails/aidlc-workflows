import { accept } from "../../kernel/fixtures/accept.ts";
import { pluginId } from "../../workflow-definition/domain/identities.ts";
import { expect, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import type { CoreAgent } from "../../workflow-definition/domain/agent.ts";
import { agent } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { createAgentPersonaPreparer } from "./agent-persona.ts";

const personaAgent = (): CoreAgent => ({ slug: agent("aidlc-example-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-example-agent.md" }),
  displayName: "Example", description: "Role", examples: [], owner: { kind: "core" },
  model: { kind: "tier", tier: "balanced" }, tools: { disallowed: [] }, maxTurns: null,
  persona: { text: "<!-- aidlc-delegated-knowledge-preflight -->\nBody {{HARNESS_DIR}}", headings: [] },
  additions: { afterPreflight: [], endOfBody: [] } });

const inputs = () => ({ sources: [], reviewerAgents: new Set<string>(), directory: ".claude", sharedKnowledge: "shared",
  tokens: tokenBindingsFixture({ harnessDir: ".claude" }) });

test("captured authored bytes retain their formatting and bind tokens rather than reconstructing the persona", () => {
  const agent = personaAgent();
  const prepare = createAgentPersonaPreparer({ ...inputs(), sources: [{ owner: { kind: "core" }, path: agent.source,
    content: { kind: "text", text: "<!-- aidlc-delegated-knowledge-preflight -->\r\nAuthored {{HARNESS_DIR}}\r\n" } }] });
  expect(prepare({ agent, text: "authored-file", knowledge: "absorbed", reading: "whole-files" }))
    .toEqual(accepted("<!-- aidlc-delegated-knowledge-preflight -->\r\nAuthored .claude\r\n"));
});

test("a missing authored source refuses its actual agent without falling back to persona text", () => {
  expect(createAgentPersonaPreparer(inputs())({ agent: personaAgent(), text: "authored-file", knowledge: "absorbed", reading: "whole-files" }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "agent", name: "aidlc-example-agent",
      reason: "The accepted agent's authored source was not captured." } });
});

test("captured source identity includes the plugin owner rather than path alone", () => {
  const core = personaAgent();
  const prepare = createAgentPersonaPreparer({ ...inputs(), sources: [{ owner: { kind: "plugin", plugin: accept(pluginId("other")) },
    path: core.source, content: { kind: "text", text: "Wrong plugin bytes" } }] });
  expect(prepare({ agent: { ...core, owner: { kind: "plugin", plugin: accept(pluginId("wanted")) } }, text: "authored-file",
    knowledge: "preflight-only", reading: "whole-files" })).toEqual({ ok: false, refusal: { kind: "render-failed",
    concept: "agent", name: "aidlc-example-agent", reason: "The accepted agent's authored source was not captured." } });
});

test("persona-body is an explicit source-independent request", () => {
  expect(createAgentPersonaPreparer(inputs())({ agent: personaAgent(), text: "persona-body", knowledge: "preflight-only", reading: "whole-files" }))
    .toEqual(accepted("<!-- aidlc-delegated-knowledge-preflight -->\nBody .claude"));
});

test("reviewer knowledge is absorbed from the same captured snapshot before tokens are bound", () => {
  const prepare = createAgentPersonaPreparer({ ...inputs(), reviewerAgents: new Set(["aidlc-example-agent"]), sources: [{
    owner: { kind: "core" }, path: methodSource({ kind: "knowledge", within: "aidlc-example-agent/a.md" }),
    content: { kind: "text", text: "Knowledge {{HARNESS_DIR}}\n" } }] });
  expect(prepare({ agent: personaAgent(), text: "persona-body", knowledge: "absorbed", reading: "whole-files" }))
    .toEqual(accepted("<!-- aidlc-delegated-knowledge-preflight -->\nBody .claude\n\n---\n\n<!-- Absorbed at build time from knowledge/aidlc-example-agent/a.md - edit that file, not this generated copy. -->\n\nKnowledge .claude\n"));
});

test("preflight-only requests do not absorb captured reviewer knowledge", () => {
  const prepare = createAgentPersonaPreparer({ ...inputs(), reviewerAgents: new Set(["aidlc-example-agent"]), sources: [{
    owner: { kind: "core" }, path: methodSource({ kind: "knowledge", within: "aidlc-example-agent/a.md" }),
    content: { kind: "text", text: "This reviewer checklist must not enter the native worker persona." } }] });
  expect(prepare({ agent: personaAgent(), text: "persona-body", knowledge: "preflight-only", reading: "whole-files" }))
    .toEqual(accepted("<!-- aidlc-delegated-knowledge-preflight -->\nBody .claude"));
});
