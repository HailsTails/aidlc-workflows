import { tokenBindingsFixture } from "../../../projection/fixtures/token-bindings.fixture.ts";
import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { host, path, source } from "../../../kernel/fixtures/values.fixture.ts";
import type { AgentRenderingInputs } from "../../../projection/application/ports/agents.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agent } from "../../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../../../workflow-definition/fixtures/method-source.fixture.ts";
import { kiroIdeAgents } from "./agent-renderer.ts";

const agentFixture: Agent = {
  slug: agent("aidlc-architect-agent"), source: methodSource({ kind: "agent", within: "aidlc-architect-agent.md" }),
  displayName: "Architect", description: "Architecture", owner: { kind: "core" },
  model: { kind: "tier", tier: "judgment" }, examples: [], tools: { disallowed: [] }, maxTurns: null,
  persona: { text: "# Architect\n", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};
const file = { source: source("agents/aidlc-aidlc.md"), content: { kind: "text" as const,
  text: 'before\n        - "{{INVOKE}} engine *"\nafter\n' } };
const expanded = { ...file, content: { kind: "text" as const,
  text: 'before\n        - "{{INVOKE}} engine *"\n        - "{{INVOKE}} doctor"\nafter\n' } };
const prepared = { ...file, content: { kind: "text" as const,
  text: 'before\n        - "aidlc engine *"\n        - "aidlc doctor"\nafter\n' } };
const inputs: AgentRenderingInputs = {
  tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
  documents: () => accepted(""), tomlModels: () => accepted(""), inlineAgents: new Set(),
  host: host({ name: "kiro-ide", directory: ".kiro" }), channel: "native", files: [file],
  prepare: () => accepted(prepared), models: () => accepted(undefined), formatDocuments: new Set(),
  allows: { dispatcherCommands: ["doctor"], toolScripts: ["unused.ts"] },
};

test("conductor expands authored invocation first then prepares once at its native destination", () => {
  const prepare = mock(() => accepted(prepared));
  expect(kiroIdeAgents({ ...inputs, prepare }).renderConductorAgent({ knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc-aidlc.md"), content: prepared.content, mode: "regular", availability: "always",
    origin: { kind: "harness-authored", source: file.source },
  }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith(expanded);
});

test("D5 leaves persona rendering with the existing emitter", () => {
  const prepare = mock(() => accepted(prepared));
  expect(kiroIdeAgents({ ...inputs, prepare }).renderAgent({ agent: agentFixture, knowledge: [] })).toEqual(accepted([]));
  expect(prepare).not.toHaveBeenCalled();
});

test("a missing captured conductor refuses with its source", () => {
  expect(kiroIdeAgents({ ...inputs, files: [] }).renderConductorAgent({ knowledge: [] })).toEqual(refused({
    kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
    reason: "The authored Kiro IDE conductor was not captured.",
  }));
});

test("an absent engine token refuses before preparation", () => {
  const prepare = mock(() => accepted(prepared));
  expect(kiroIdeAgents({ ...inputs, prepare, files: [{ ...file, content: { kind: "text", text: "none" } }] })
    .renderConductorAgent({ knowledge: [] })).toEqual(refused({
      kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
      reason: "agents/aidlc-aidlc.md must allow {{INVOKE}} engine * exactly once",
    }));
  expect(prepare).not.toHaveBeenCalled();
});

test("a token preparation refusal is preserved exactly", () => {
  const failure = refused({ kind: "host-source-unreadable" as const, host: inputs.host,
    source: file.source, reason: "Cannot prepare captured conductor." });
  expect(kiroIdeAgents({ ...inputs, prepare: () => failure }).renderConductorAgent({ knowledge: [] })).toEqual(failure);
});
