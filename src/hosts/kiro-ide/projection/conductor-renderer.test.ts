import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { DELEGATE_SHELL_FACTS } from "../../../projection/fixtures/delegate-shell-facts.fixture.ts";
import { tokenBindingsFixture } from "../../../projection/fixtures/token-bindings.fixture.ts";
import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { host, path, source } from "../../../kernel/fixtures/values.fixture.ts";
import type { AgentRenderingInputs } from "../../../projection/application/ports/agents.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import { agent } from "../../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../../../workflow-definition/fixtures/method-source.fixture.ts";
import { createKiroIdeAgents } from "./agent-renderer.ts";

const kiroIdeAgents = createKiroIdeAgents({ personas: () => () => accepted([]) });

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
  delegateShellFacts: DELEGATE_SHELL_FACTS,
  tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
  documents: () => accepted(""), modelCap: null, method: methodSliceFixture,
  host: host({ name: "kiro-ide", directory: ".kiro" }), channel: "native", files: [file],
  prepare: () => accepted(prepared), models: () => accepted(undefined), formatDocuments: new Set(),
  allows: { dispatcherCommands: ["doctor"], toolScripts: ["unused.ts"] },
};

test("conductor expands authored invocation first then prepares once at its native destination", () => {
  const prepare = mock(() => accepted(prepared));
  expect(kiroIdeAgents({ ...inputs, prepare }).renderConductorAgent({ knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc-aidlc.md"), content: prepared.content, mode: "regular",
    origin: { kind: "harness-authored", source: file.source },
  }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith(expanded);
});

test("persona delegation does not invoke the conductor preparer", () => {
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

test("native conductor collapses the trusted pair after preparation and preserves dispatcher ordering", () => {
  const captured = { ...file, content: { kind: "text" as const, text:
    'permissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "bun .kiro/tools/aidlc-*"\n        - "{{INVOKE}} engine *"\n        - "bun --version"\n    - capability: shell\n      effect: ask\n      match:\n        - "{{INVOKE}} engine config set *"\n        - "bun .kiro/tools/aidlc*$*"\n' } };
  const prepare = mock(() => accepted({ ...file, content: { kind: "text" as const, text:
    'permissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "bun .kiro/tools/aidlc-*"\n        - "aidlc engine *"\n        - "aidlc doctor"\n        - "bun --version"\n    - capability: shell\n      effect: ask\n      match:\n        - "aidlc engine config set *"\n        - "bun .kiro/tools/aidlc*$*"\n' } }));
  expect(kiroIdeAgents({ ...inputs, files: [captured], prepare }).renderConductorAgent({ knowledge: [] }))
    .toEqual(accepted([{ path: path(".kiro/agents/aidlc-aidlc.md"), mode: "regular",
      origin: { kind: "harness-authored", source: file.source }, content: { kind: "text", text:
        'permissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "aidlc engine *"\n        - "aidlc doctor"\n        - "bun --version"\n    - capability: shell\n      effect: ask\n      match:\n        - "aidlc engine config set *"\n        - "aidlc*$*"\n' },
    }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith({ ...captured, content: { kind: "text", text:
    'permissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "bun .kiro/tools/aidlc-*"\n        - "{{INVOKE}} engine *"\n        - "{{INVOKE}} doctor"\n        - "bun --version"\n    - capability: shell\n      effect: ask\n      match:\n        - "{{INVOKE}} engine config set *"\n        - "bun .kiro/tools/aidlc*$*"\n' } });
});
