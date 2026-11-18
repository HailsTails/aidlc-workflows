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


const CONDUCTOR_CONSUMER_CASES = {
  "ambiguous": "---\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"bun {{HARNESS_DIR}}/tools/aidlc-*\"\n        - \"{{INVOKE}} engine *\"\n        - \"bun --version\"\n    - capability: shell\n      effect: allow\n      match:\n        - \"authored source placeholder\"\n    - capability: fs_read\n      effect: allow\n      match:\n        - \"**\"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n",
  "duplicate": "---\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"bun {{HARNESS_DIR}}/tools/aidlc-*\"\n        - \"{{INVOKE}} engine *\"\n        - \"{{INVOKE}} engine *\"\n        - \"bun --version\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"authored source placeholder\"\n    - capability: fs_read\n      effect: allow\n      match:\n        - \"**\"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n",
  "crlf": "---\r\npermissions:\r\n  rules:\r\n    - capability: shell\r\n      effect: allow\r\n      match:\r\n        - \"bun {{HARNESS_DIR}}/tools/aidlc-*\"\r\n        - \"{{INVOKE}} engine *\"\r\n        - \"bun --version\"\r\n    - capability: shell\r\n      effect: ask\r\n      match:\r\n        - \"authored source placeholder\"\r\n    - capability: fs_read\r\n      effect: allow\r\n      match:\r\n        - \"**\"\r\n---\r\nBody: bun .kiro/tools/aidlc.ts engine *\r\n",
  "crlfExpected": "---\r\npermissions:\r\n  rules:\r\n    - capability: shell\r\n      effect: allow\r\n      match:\r\n        - \"aidlc engine *\"\r\n        - \"aidlc doctor\"\r\n        - \"bun --version\"\r\n    - capability: shell\r\n      effect: ask\r\n      match:\r\n        - \"aidlc engine config set *\"\r\n        - \"aidlc engine adapter *\"\r\n        - \"aidlc*$*\"\r\n        - \"aidlc*`*\"\r\n        - \"aidlc*>*\"\r\n        - \"aidlc*<*\"\r\n        - \"aidlc*&*\"\r\n        - \"aidlc*@(*\"\r\n        - \"aidlc*@{*\"\r\n        - \"aidlc*\\n*\"\r\n        - \"*aidlc-doctor.ts*\"\r\n        - \"*aidlc-init.ts*\"\r\n        - \"*aidlc-lifecycle.ts*\"\r\n        - \"*aidlc-machine-config.ts*\"\r\n    - capability: fs_read\r\n      effect: allow\r\n      match:\r\n        - \"**\"\r\n---\r\nBody: bun .kiro/tools/aidlc.ts engine *\r\n"
} as const;


const kiroIdeAgents = createKiroIdeAgents({ personas: () => () => accepted([]) });

const agentFixture: Agent = {
  slug: agent("aidlc-architect-agent"), source: methodSource({ kind: "agent", within: "aidlc-architect-agent.md" }),
  displayName: "Architect", description: "Architecture", owner: { kind: "core" },
  model: { kind: "tier", tier: "judgment" }, examples: [], tools: { disallowed: [] }, maxTurns: null,
  persona: { text: "# Architect\n", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};
const capturedConductor = { source: source("agents/aidlc-aidlc.md"), content: { kind: "text" as const, text:
  '---\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "bun {{HARNESS_DIR}}/tools/aidlc-*"\n        - "{{INVOKE}} engine *"\n        - "bun --version"\n    - capability: shell\n      effect: ask\n      match:\n        - "authored source placeholder"\n    - capability: fs_read\n      effect: allow\n      match:\n        - "**"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n' } };

const nativeConductorSource = '---\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - "aidlc engine *"\n        - "aidlc doctor"\n        - "bun --version"\n    - capability: shell\n      effect: ask\n      match:\n        - "aidlc engine config set *"\n        - "aidlc engine adapter *"\n        - "aidlc*$*"\n        - "aidlc*`*"\n        - "aidlc*>*"\n        - "aidlc*<*"\n        - "aidlc*&*"\n        - "aidlc*@(*"\n        - "aidlc*@{*"\n        - "aidlc*\\n*"\n        - "*aidlc-doctor.ts*"\n        - "*aidlc-init.ts*"\n        - "*aidlc-lifecycle.ts*"\n        - "*aidlc-machine-config.ts*"\n    - capability: fs_read\n      effect: allow\n      match:\n        - "**"\n---\nBody: bun .kiro/tools/aidlc.ts engine *\n';

const file = capturedConductor;
const expanded = { ...file, content: { kind: "text" as const, text: nativeConductorSource } };
const prepared = { ...file, content: { kind: "text" as const,
  text: 'before\n        - "aidlc engine *"\n        - "aidlc doctor"\nafter\n' } };
const inputs: AgentRenderingInputs = {
  delegateShellFacts: DELEGATE_SHELL_FACTS,
  tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
  documents: () => accepted(""), modelCap: null, tierFlavor: "kiro", method: methodSliceFixture,
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

test("native conductor generates policy before preparation and never reinterprets prepared output", () => {
  const prepare = mock(() => accepted({ ...file, content: { kind: "text" as const,
    text: '    - capability: shell\n      effect: ask\n      match:\n        - "bun .kiro/tools/aidlc*$*"\n' } }));
  expect(kiroIdeAgents({ ...inputs, files: [capturedConductor], prepare }).renderConductorAgent({ knowledge: [] }))
    .toEqual(accepted([{ path: path(".kiro/agents/aidlc-aidlc.md"), mode: "regular",
      origin: { kind: "harness-authored", source: file.source }, content: { kind: "text", text:
        '    - capability: shell\n      effect: ask\n      match:\n        - "bun .kiro/tools/aidlc*$*"\n' },
    }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith({ ...capturedConductor, content: { kind: "text", text: nativeConductorSource } });
});

test("copy conductor preserves the preparer's byte object", () => {
  const content = { kind: "bytes" as const, bytes: new Uint8Array([255, 0, 17]) };
  const prepare = mock(() => accepted({ ...file, content }));
  const rendering = kiroIdeAgents({ ...inputs, channel: "copy", prepare }).renderConductorAgent({ knowledge: [] });
  expect(rendering).toEqual(accepted([{ path: path(".kiro/agents/aidlc-aidlc.md"), mode: "regular", content,
    origin: { kind: "harness-authored", source: file.source } }]));
  expect(rendering.ok && rendering.value[0]?.content).toBe(content);
});

test("native conductor decodes prepared bytes without changing their text", () => {
  const prepare = mock(() => accepted({ ...file, content: { kind: "bytes" as const, bytes: new Uint8Array([35, 32, 65, 10]) } }));
  expect(kiroIdeAgents({ ...inputs, prepare }).renderConductorAgent({ knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc-aidlc.md"), content: { kind: "text", text: "# A\n" }, mode: "regular",
    origin: { kind: "harness-authored", source: file.source },
  }]));
});

test("invalid permission admission refuses before preparation and emits no file", () => {
  const prepare = mock(accepted);
  const ambiguous = { ...file, content: { kind: "text" as const,
    text: CONDUCTOR_CONSUMER_CASES.ambiguous } };
  expect(kiroIdeAgents({ ...inputs, files: [ambiguous], prepare }).renderConductorAgent({ knowledge: [] }))
    .toEqual(refused({ kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
      reason: "The conductor permission template requires exactly one shell allow and one shell ask rule." }));
  expect(prepare).not.toHaveBeenCalled();
});

test("duplicate dispatcher slots retain the existing refusal before permission admission", () => {
  const prepare = mock(accepted);
  const duplicate = { ...file, content: { kind: "text" as const,
    text: CONDUCTOR_CONSUMER_CASES.duplicate } };
  expect(kiroIdeAgents({ ...inputs, files: [duplicate], prepare }).renderConductorAgent({ knowledge: [] }))
    .toEqual(refused({ kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
      reason: "agents/aidlc-aidlc.md must allow {{INVOKE}} engine * exactly once" }));
  expect(prepare).not.toHaveBeenCalled();
});

test("CRLF conductor expansion and permission admission share the original newline form", () => {
  const prepare = mock(accepted);
  const crlf = { ...file, content: { kind: "text" as const,
    text: CONDUCTOR_CONSUMER_CASES.crlf } };
  expect(kiroIdeAgents({ ...inputs, files: [crlf], prepare }).renderConductorAgent({ knowledge: [] }))
    .toMatchObject({ ok: true, value: [{ content: { kind: "text",
      text: CONDUCTOR_CONSUMER_CASES.crlfExpected } }] });
  expect(prepare).toHaveBeenCalledTimes(1);
});
