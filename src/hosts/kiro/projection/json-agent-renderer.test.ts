import { DELEGATE_SHELL_FACTS } from "../../../projection/fixtures/delegate-shell-facts.fixture.ts";
import type { AgentDocumentSurface, AgentRenderingInputs } from "../../../projection/application/ports/agents.ts";
import { tokenBindingsFixture } from "../../../projection/fixtures/token-bindings.fixture.ts";
import { expect, mock, test } from "bun:test";
import { brand } from "../../../kernel/brand.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import type { DistributionId, ProjectPath, SourcePath } from "../../../kernel/values.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import type { Agent } from "../../../workflow-definition/domain/agent.ts";
import type { AgentSlug } from "../../../workflow-definition/domain/identities.ts";
import type { MethodSourcePath } from "../../../workflow-definition/domain/method-source.ts";
import { kiroJsonAgentRenderer, createKiroJsonAgentRenderer, kiroAgents } from "./json-agent-renderer.ts";

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
const allows = { dispatcherCommands: [], toolScripts: [] };

const allowFile: AuthoredHostFile = {
  source: brand<SourcePath>("agents/aidlc-allow-fixture.json"),
  content: { kind: "text", text:
    '{"toolsSettings":{"execute_bash":{"allowedCommands":["bun (run )?[\\"\\u0027]?\\\\.kiro/tools/[A-Za-z0-9._-]+\\\\.ts[\\"\\u0027]?( .*)?"]}}}' },
};


test("persona uses captured input and a typed policy decision", () => {
  const decision = mock(() => accepted({ kind: "project", model: "chosen" } as const));
  expect(kiroJsonAgentRenderer({ host, allows, files: [file], formatDocuments,
    modelDecision: decision, hookCommandSuffix: undefined })({ agent, knowledge: [] }))
    .toMatchObject({ ok: true, value: [{
      path: ".kiro/agents/aidlc-architect-agent.json",
      content: { text: '{\n  "name": "original",\n  "custom": true,\n  "model": "chosen"\n}\n' },
    }] });
  expect(decision).toHaveBeenCalledWith({ agent, file });
});

test("missing captured persona refuses before policy resolution", () => {
  const decision = mock(() => accepted({ kind: "preserve" } as const));
  expect(kiroJsonAgentRenderer({ host, allows, files: [], formatDocuments,
    modelDecision: decision, hookCommandSuffix: undefined })({ agent, knowledge: [] }))
    .toMatchObject({ ok: false, refusal: { kind: "render-failed" } });
  expect(decision).not.toHaveBeenCalled();
});

test("policy refusal precedes malformed JSON preparation", () => {
  const failure = { kind: "render-failed", concept: "agent", name: agent.slug,
    reason: "Missing model tier." } as const;
  expect(kiroJsonAgentRenderer({ host, allows,
    files: [{ ...file, content: { kind: "text", text: "malformed" } }], formatDocuments,
    modelDecision: () => refused(failure), hookCommandSuffix: undefined,
  })({ agent, knowledge: [] })).toEqual(refused(failure));
});

test("preparation refusal preserves its host, source and stage reason", () => {
  expect(kiroJsonAgentRenderer({ host, allows,
    files: [{ ...file, content: { kind: "text", text: "null" } }], formatDocuments,
    modelDecision: () => accepted({ kind: "preserve" }), hookCommandSuffix: undefined,
  })({ agent, knowledge: [] })).toEqual(refused({
    kind: "host-source-unreadable", host, source: file.source,
    reason: "Kiro shared-resource preparation: the document cannot be null.",
  }));
});

test("the published agent member prepares a persona once and delegates its model", () => {
  const prepare = mock(accepted<AuthoredHostFile>);
  const models = mock(() => accepted(undefined));
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({
    delegateShellFacts: DELEGATE_SHELL_FACTS, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
    documents: () => accepted(""), tomlModels: () => accepted(""), inlineAgents: new Set(),
    host, formatDocuments, channel: "copy",
    files: [file, allowFile, { source: brand<SourcePath>("skills/aidlc/SKILL.md"),
      content: { kind: "text", text: "# Authored skill" } }],
    prepare, models, allows: { dispatcherCommands: [], toolScripts: [] } });
  expect(render.renderAgent({ agent, knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc-architect-agent.json"), mode: "regular", availability: "always",
    content: { kind: "text", text: '{\n  "name": "original",\n  "custom": true\n}\n' },
    origin: { kind: "harness-authored", source: file.source },
  }]));
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(models).toHaveBeenCalledWith({ host, agent: agent.slug, model: agent.model });
});

test("the conductor preserves its model and appends the native hook suffix once", () => {
  const conductor: AuthoredHostFile = { source: brand<SourcePath>("agents/aidlc.json"),
    content: { kind: "text", text: '{"model":"personal","hooks":{"pre":[{"command":"run"}]}}' } };
  const prepare = mock(accepted<AuthoredHostFile>);
  const models = mock(() => accepted("unused"));
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({
    delegateShellFacts: DELEGATE_SHELL_FACTS, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
    documents: () => accepted(""), tomlModels: () => accepted(""), inlineAgents: new Set(),
    host, formatDocuments, channel: "native",
    files: [conductor, allowFile], prepare, models, allows: { dispatcherCommands: [], toolScripts: [] } });
  expect(render.renderConductorAgent({ knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc.json"), mode: "regular", availability: "always",
    content: { kind: "text", text: '{\n  "model": "personal",\n  "hooks": {\n    "pre": [\n      {\n        "command": "run; exit $LASTEXITCODE"\n      }\n    ]\n  }\n}\n' },
    origin: { kind: "harness-authored", source: conductor.source },
  }]));
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(models).not.toHaveBeenCalled();
});

test("the published member preserves a preparation refusal before model lookup", () => {
  const failure = { kind: "host-source-unreadable", host, source: file.source, reason: "token failure" } as const;
  const models = mock(() => accepted("unused"));
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({
    delegateShellFacts: DELEGATE_SHELL_FACTS, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
    documents: () => accepted(""), tomlModels: () => accepted(""), inlineAgents: new Set(),
    host, formatDocuments, channel: "copy",
    files: [file], prepare: () => refused(failure), models,
    allows: { dispatcherCommands: [], toolScripts: [] } });
  expect(render.renderAgent({ agent, knowledge: [] })).toEqual(refused(failure));
  expect(models).not.toHaveBeenCalled();
});
test("the native factory refuses the whole set when no document has a tools-folder pattern", () => {
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({
    delegateShellFacts: DELEGATE_SHELL_FACTS, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
    documents: () => accepted(""), tomlModels: () => accepted(""), inlineAgents: new Set(),
    host, formatDocuments, channel: "copy", files: [file], prepare: accepted,
    models: () => accepted(undefined), allows: { dispatcherCommands: [], toolScripts: [] },
  });
  const failure = refused({ kind: "render-failed" as const, concept: "agent" as const, name: "kiro",
    reason: "[kiro] no agent names the tools-folder pattern to expand" });
  expect(render.renderAgent({ agent, knowledge: [] })).toEqual(failure);
  expect(render.renderConductorAgent({ knowledge: [] })).toEqual(failure);
});

test("a refusal in another captured agent prevents partial rendering", () => {
  const failure = refused({ kind: "host-source-unreadable" as const, host,
    source: allowFile.source, reason: "The other captured source could not be prepared." });
  const prepare = mock().mockReturnValueOnce(accepted(file)).mockReturnValueOnce(failure);
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({
    delegateShellFacts: DELEGATE_SHELL_FACTS, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
    documents: () => accepted(""), tomlModels: () => accepted(""), inlineAgents: new Set(),
    host, formatDocuments, channel: "copy", files: [file, allowFile], prepare,
    models: () => accepted(undefined), allows: { dispatcherCommands: [], toolScripts: [] },
  });
  expect(render.renderAgent({ agent, knowledge: [] })).toEqual(failure);
  expect(render.renderConductorAgent({ knowledge: [] })).toEqual(failure);
  expect(prepare).toHaveBeenCalledTimes(2);
});

test("conductor hook overflow is serialized before the final allow-list rewrite", () => {
  const conductor: AuthoredHostFile = { source: brand<SourcePath>("agents/aidlc.json"), content: { kind: "text",
    text: '{"hooks":{"pre":[1e400]},"toolsSettings":{"execute_bash":{"allowedCommands":["keep"]}}}' } };
  const render = createKiroJsonAgentRenderer({ host, formatDocuments })({
    delegateShellFacts: DELEGATE_SHELL_FACTS, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted(""),
    documents: () => accepted(""), tomlModels: () => accepted(""), inlineAgents: new Set(),
    host, formatDocuments, channel: "copy", files: [conductor, allowFile], prepare: accepted,
    models: () => accepted(undefined), allows: { dispatcherCommands: [], toolScripts: [] },
  });
  expect(render.renderConductorAgent({ knowledge: [] })).toEqual(accepted([{
    path: path(".kiro/agents/aidlc.json"), mode: "regular", availability: "always",
    origin: { kind: "harness-authored", source: conductor.source }, content: { kind: "text",
      text: '{\n  "hooks": {\n    "pre": [\n      null\n    ]\n  },\n  "toolsSettings": {\n    "execute_bash": {\n      "allowedCommands": [\n        "keep"\n      ]\n    }\n  }\n}\n' },
  }]));
});
const nativeInputs = (documents: AgentDocumentSurface): AgentRenderingInputs => ({
  delegateShellFacts: DELEGATE_SHELL_FACTS, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }), persona: () => accepted("unused"),
  documents, tomlModels: () => accepted("unused"), inlineAgents: new Set(), host, formatDocuments,
  channel: "copy", files: [file, allowFile], prepare: accepted, models: () => accepted(undefined), allows,
});

test("Kiro's native factory returns JSON then Markdown with the exact in-parts request", () => {
  const documents = mock(() => accepted("---\nname: architect\n---\nRead .kiro/steering/project.md.\n"));
  const prepare = mock(accepted<AuthoredHostFile>);
  const renderer = kiroAgents({ ...nativeInputs(documents), prepare });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(accepted([
    { path: path(".kiro/agents/aidlc-architect-agent.json"), mode: "regular", availability: "always",
      content: { kind: "text", text: '{\n  "name": "original",\n  "custom": true\n}\n' },
      origin: { kind: "harness-authored", source: file.source } },
    { path: path(".kiro/agents/aidlc-architect-agent.md"), mode: "regular", availability: "always",
      content: { kind: "text", text: '---\nname: architect\ntools: ["read", "write", "shell"]\n' +
        'includeMcpJson: true\n---\nRead .kiro/steering/project.md.\n' },
      origin: { kind: "method-source", path: agent.source } },
  ]));
  expect(documents).toHaveBeenCalledTimes(1);
  expect(documents).toHaveBeenCalledWith({ agent, text: "authored-file", knowledge: "absorbed", reading: "in-parts",
    frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain",
      insertBeforeKeys: [], removeKeys: ["disallowedTools"], afterProjectionLines: [] } });
  expect(prepare).toHaveBeenCalledTimes(2);
});

test("Kiro's JSON refusal prevents the Markdown request", () => {
  const documents = mock(() => accepted("unused"));
  const failure = { kind: "host-source-unreadable", host, source: file.source, reason: "unreadable JSON" } as const;
  const renderer = kiroAgents({ ...nativeInputs(documents), prepare: () => refused(failure) });
  expect(renderer.renderAgent({ agent, knowledge: [] })).toEqual(refused(failure));
  expect(documents).not.toHaveBeenCalled();
});

test("Kiro's Markdown refusal returns no partial JSON output", () => {
  const failure = { kind: "render-failed", concept: "agent", name: agent.slug, reason: "missing persona" } as const;
  const documents = mock(() => refused(failure));
  expect(kiroAgents(nativeInputs(documents)).renderAgent({ agent, knowledge: [] })).toEqual(refused(failure));
  expect(documents).toHaveBeenCalledTimes(1);
});

test("Kiro's combined factory keeps its conductor JSON-only", () => {
  const documents = mock(() => accepted("unused"));
  const conductor: AuthoredHostFile = { source: brand<SourcePath>("agents/aidlc.json"),
    content: { kind: "text", text: '{"model":"personal"}' } };
  const renderer = kiroAgents({ ...nativeInputs(documents), files: [conductor, allowFile] });
  expect(renderer.renderConductorAgent({ knowledge: [] })).toEqual(accepted([
    { path: path(".kiro/agents/aidlc.json"), mode: "regular", availability: "always",
      content: { kind: "text", text: '{"model":"personal"}' },
      origin: { kind: "harness-authored", source: conductor.source } },
  ]));
  expect(documents).not.toHaveBeenCalled();
});
