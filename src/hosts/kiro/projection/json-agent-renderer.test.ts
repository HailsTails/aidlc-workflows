import { expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { DistributionId, ProjectPath, SourcePath } from "../../../kernel/values.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { kiroJsonAgentRenderer, createKiroJsonAgentRenderer } from "./json-agent-renderer.ts";

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

const host = { distribution: brand<DistributionId>("kiro"), directory: brand<ProjectPath>(".kiro") };
const formatDocuments = new Set<string>();

test("persona uses captured input and a typed policy decision", () => {
  const decision = mock(() => accepted({ kind: "project", model: "chosen" } as const));
  expect(kiroJsonAgentRenderer({ host, files: [file], formatDocuments,
    modelDecision: decision, hookCommandSuffix: undefined })({ agent, knowledge: [] }))
    .toMatchObject({ ok: true, value: [{
      path: ".kiro/agents/aidlc-architect-agent.json",
      content: { text: '{\n  "name": "original",\n  "custom": true,\n  "model": "chosen"\n}\n' },
    }] });
  expect(decision).toHaveBeenCalledWith({ agent, file });
});

test("missing captured persona refuses before policy resolution", () => {
  const decision = mock(() => accepted({ kind: "preserve" } as const));
  expect(kiroJsonAgentRenderer({ host, files: [], formatDocuments,
    modelDecision: decision, hookCommandSuffix: undefined })({ agent, knowledge: [] }))
    .toMatchObject({ ok: false, refusal: { kind: "render-failed" } });
  expect(decision).not.toHaveBeenCalled();
});

test("policy refusal precedes malformed JSON preparation", () => {
  const failure = { kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "Missing model tier." } as const;
  expect(kiroJsonAgentRenderer({ host,
    files: [{ ...file, content: { kind: "text", text: "malformed" } }], formatDocuments,
    modelDecision: () => refused(failure), hookCommandSuffix: undefined,
  })({ agent, knowledge: [] })).toEqual(refused(failure));
});

test("preparation refusal preserves its host, source and stage reason", () => {
  expect(kiroJsonAgentRenderer({ host,
    files: [{ ...file, content: { kind: "text", text: "null" } }], formatDocuments,
    modelDecision: () => accepted({ kind: "preserve" }), hookCommandSuffix: undefined,
  })({ agent, knowledge: [] })).toEqual(refused({
    kind: "host-source-unreadable", host, source: file.source,
    reason: "Kiro shared-resource preparation: the document cannot be null.",
  }));
});

test("the published agent member prepares a persona once and delegates its model", () => {
  const prepare = mock(() => accepted(file));
  const models = mock(() => accepted(undefined));
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({ host, formatDocuments, channel: "copy",
    files: [file], prepare, models, allows: { dispatcherCommands: [], toolScripts: [] } });
  expect(render.renderAgent({ agent, knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc-architect-agent.json"), mode: "regular", availability: "always",
    content: { kind: "text", text: '{\n  "name": "original",\n  "custom": true\n}\n' },
    origin: { kind: "harness-authored", source: file.source },
  }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(models).toHaveBeenCalledWith({ host, agent: agent.slug, model: agent.model });
});

test("the conductor preserves its model and appends the native hook suffix once", () => {
  const conductor: AuthoredHostFile = { source: brand<SourcePath>("agents/aidlc.json"),
    content: { kind: "text", text: '{"model":"personal","hooks":{"pre":[{"command":"run"}]}}' } };
  const prepare = mock(() => accepted(conductor));
  const models = mock(() => accepted("unused"));
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({ host, formatDocuments, channel: "native",
    files: [conductor], prepare, models, allows: { dispatcherCommands: [], toolScripts: [] } });
  expect(render.renderConductorAgent({ knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc.json"), mode: "regular", availability: "always",
    content: { kind: "text", text: '{\n  "model": "personal",\n  "hooks": {\n    "pre": [\n      {\n        "command": "run; exit $LASTEXITCODE"\n      }\n    ]\n  }\n}\n' },
    origin: { kind: "harness-authored", source: conductor.source },
  }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(models).not.toHaveBeenCalled();
});

test("the published member preserves a preparation refusal before model lookup", () => {
  const failure = { kind: "host-source-unreadable", host, source: file.source, reason: "token failure" } as const;
  const models = mock(() => accepted("unused"));
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({ host, formatDocuments, channel: "copy",
    files: [file], prepare: () => refused(failure), models,
    allows: { dispatcherCommands: [], toolScripts: [] } });
  expect(render.renderAgent({ agent, knowledge: [] })).toEqual(refused(failure));
  expect(models).not.toHaveBeenCalled();
});