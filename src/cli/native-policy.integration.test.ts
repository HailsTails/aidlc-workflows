// Thin in-memory composition contracts: real owner, serializers and consumer.
import { expect, test } from "bun:test";
import { accepted } from "../kernel/result.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { host, path, source } from "../kernel/fixtures/values.fixture.ts";
import { agent } from "../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../workflow-definition/fixtures/method-source.fixture.ts";
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import type { Agent } from "../workflow-definition/domain/agent.ts";
import { admittedVerbs } from "../projection/adapters/legacy-delegate-admission.ts";
import { DELEGATE_SHELL_FACTS } from "../projection/fixtures/delegate-shell-facts.fixture.ts";
import { SCRATCH_AGENT_INPUTS } from "../projection/fixtures/scratch-host.fixture.ts";
import { tokenBindingsFixture } from "../projection/fixtures/token-bindings.fixture.ts";
import { createKiroIdeAgents } from "../hosts/kiro-ide/projection/agent-renderer.ts";
import { kiroAgentRenderer } from "../hosts/kiro/projection/agent-renderer.ts";
import { kiroIdeHostData } from "../hosts/kiro-ide/projection/host-data-renderer.ts";
import { createKiroIdeHarnessRecord } from "../hosts/kiro-ide/projection/harness-record.ts";
import { kiroIdeDistribution } from "../hosts/kiro-ide/distribution.ts";
import { createHostSurfaceMembers } from "../projection/application/host-surface-members.ts";
import { nativeLayoutFiles } from "../packaging/application/native-layout.ts";

const identity = host({ name: "kiro-ide", directory: ".kiro" });
const facts = { ...DELEGATE_SHELL_FACTS, admittedVerbs };
const developer: Agent = {
  slug: agent("aidlc-developer-agent"), source: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }),
  displayName: "Developer", description: "Fixture", owner: { kind: "core" },
  model: { kind: "tier", tier: "judgment" }, examples: [], tools: { disallowed: ["Task"] }, maxTurns: null,
  persona: { text: "Body\n", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};
const pipeline: Agent = { ...developer, slug: agent("aidlc-pipeline-deploy-agent"),
  source: methodSource({ kind: "agent", within: "aidlc-pipeline-deploy-agent.md" }) };
const routes = { prefix: "aidlc engine", namespace: "engine", delegates: [], adapterHooks: new Set<string>(),
  trusted: DELEGATE_SHELL_FACTS.trustedCommand, unresolvable: () => [] };

const composed = (surfaced: string) => {
  const renderers = createKiroIdeAgents({ personas: kiroAgentRenderer })({ ...SCRATCH_AGENT_INPUTS,
    host: identity, channel: "native", delegateShellFacts: facts,
    method: { ...methodSliceFixture, stages: [] }, documents: () => accepted(surfaced),
  });
  const developers = accept(renderers.renderAgent({ agent: developer, knowledge: [] }));
  const pipelines = accept(renderers.renderAgent({ agent: pipeline, knowledge: [] }));
  const ownerData = kiroIdeHostData({ delegateShellFacts: facts });
  const surface = createHostSurfaceMembers({ host: identity, channel: "native", placements: [], prepare: accepted,
    record: createKiroIdeHarnessRecord, tokens: tokenBindingsFixture({ harnessDir: ".kiro" }),
    data: { productName: "Fixture", configNextStep: "Open", rulesFolder: null,
      pluginAgentFrontmatter: ownerData.pluginAgentFrontmatter ?? { copy: [], native: [] } },
  });
  const release = accept(kiroIdeDistribution({ delegateShellFacts: facts })).native;
  return { release, personaFiles: [...developers, ...pipelines],
    pluginFiles: [...accept(surface.renderHostData()), ...pipelines] };
};

const EXPECTED_PERSONA_LF = "---\nname: fixture\nmodel: selected\ntools: [\"read\", \"write\", \"shell\"]\nincludeMcpJson: true\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"aidlc engine *\"\n        - \"bun --version\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"aidlc engine config set *\"\n        - \"aidlc engine adapter *\"\n        - \"aidlc*$*\"\n        - \"aidlc*`*\"\n        - \"aidlc*>*\"\n        - \"aidlc*<*\"\n        - \"aidlc*&*\"\n        - \"aidlc*@(*\"\n        - \"aidlc*@{*\"\n        - \"aidlc*\\n*\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc engine *\"\n      exclude:\n    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc*$*\"\n        - \"aidlc*`*\"\n        - \"aidlc*>*\"\n        - \"aidlc*<*\"\n        - \"aidlc*&*\"\n        - \"aidlc*@(*\"\n        - \"aidlc*@{*\"\n        - \"aidlc*\\n*\"\n    - capability: fs_read\n      effect: allow\n      match:\n        - \"**\"\n    - capability: filesystem\n      effect: allow\n      match:\n        - \"aidlc/spaces/**\"\n        - \".aidlc/worktrees/*/aidlc/spaces/**\"\n    - capability: fs_write\n      effect: deny\n      match:\n        - \".kiro/**\"\n        - \"aidlc/.aidlc-sessions/**\"\n        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\"\n---\nBody\n";
const EXPECTED_PERSONA_CRLF = "---\r\nname: fixture\r\nmodel: selected\r\ntools: [\"read\", \"write\", \"shell\"]\nincludeMcpJson: true\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"aidlc engine *\"\n        - \"bun --version\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"aidlc engine config set *\"\n        - \"aidlc engine adapter *\"\n        - \"aidlc*$*\"\n        - \"aidlc*`*\"\n        - \"aidlc*>*\"\n        - \"aidlc*<*\"\n        - \"aidlc*&*\"\n        - \"aidlc*@(*\"\n        - \"aidlc*@{*\"\n        - \"aidlc*\\n*\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc engine *\"\n      exclude:\n    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc*$*\"\n        - \"aidlc*`*\"\n        - \"aidlc*>*\"\n        - \"aidlc*<*\"\n        - \"aidlc*&*\"\n        - \"aidlc*@(*\"\n        - \"aidlc*@{*\"\n        - \"aidlc*\\n*\"\n    - capability: fs_read\n      effect: allow\n      match:\n        - \"**\"\n    - capability: filesystem\n      effect: allow\n      match:\n        - \"aidlc/spaces/**\"\n        - \".aidlc/worktrees/*/aidlc/spaces/**\"\n    - capability: fs_write\n      effect: deny\n      match:\n        - \".kiro/**\"\n        - \"aidlc/.aidlc-sessions/**\"\n        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\"\n---\r\nBody\r\n";
const EXPECTED_PLUGIN = "---\ntools: [\"read\", \"write\", \"shell\"]\nincludeMcpJson: true\npermissions:\n  rules:\n    - capability: shell\n      effect: allow\n      match:\n        - \"aidlc engine *\"\n        - \"bun --version\"\n    - capability: shell\n      effect: ask\n      match:\n        - \"aidlc engine config set *\"\n        - \"aidlc engine adapter *\"\n        - \"aidlc*$*\"\n        - \"aidlc*`*\"\n        - \"aidlc*>*\"\n        - \"aidlc*<*\"\n        - \"aidlc*&*\"\n        - \"aidlc*@(*\"\n        - \"aidlc*@{*\"\n        - \"aidlc*\\n*\"\n    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc engine *\"\n      exclude:\n    - capability: shell\n      effect: deny\n      match:\n        - \"aidlc*$*\"\n        - \"aidlc*`*\"\n        - \"aidlc*>*\"\n        - \"aidlc*<*\"\n        - \"aidlc*&*\"\n        - \"aidlc*@(*\"\n        - \"aidlc*@{*\"\n        - \"aidlc*\\n*\"\n    - capability: fs_read\n      effect: allow\n      match:\n        - \"**\"\n    - capability: filesystem\n      effect: allow\n      match:\n        - \"aidlc/spaces/**\"\n        - \".aidlc/worktrees/*/aidlc/spaces/**\"\n    - capability: fs_write\n      effect: deny\n      match:\n        - \".kiro/**\"\n        - \"aidlc/.aidlc-sessions/**\"\n        - \"aidlc/spaces/*/intents/*/.aidlc-engine/gate-words/**\"\n---\n";
const EXPECTED_DESCRIPTOR = "{\n  \"schemaVersion\": 1,\n  \"distribution\": \"kiro-ide\",\n  \"productName\": \"Fixture\",\n  \"configNextStep\": \"Open\",\n  \"name\": \"kiro-ide\",\n  \"harnessDir\": \".kiro\",\n  \"rulesSubdir\": \"rules\",\n  \"kiroLayout\": \"kas\"\n}\n";

const cases = [
  { ending: "LF", surfaced: "---\nname: fixture\nmodel: selected\n---\nBody\n", text: EXPECTED_PERSONA_LF },
  { ending: "CRLF", surfaced: "---\r\nname: fixture\r\nmodel: selected\r\n---\r\nBody\r\n", text: EXPECTED_PERSONA_CRLF },
];

test.each(cases)("real persona serialization discharges both native policy classes with $ending source", ({ surfaced, text }) => {
  const flow = composed(surfaced);
  expect(flow.release.replacements).toHaveLength(2);
  expect(nativeLayoutFiles({ host: identity, routes, release: flow.release, files: flow.personaFiles })).toEqual(accepted([
    { path: path(".kiro/agents/aidlc-developer-agent.md"), content: { kind: "text", text }, mode: "regular",
      origin: { kind: "method-source", path: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }) } },
    { path: path(".kiro/agents/aidlc-pipeline-deploy-agent.md"), content: { kind: "text", text }, mode: "regular",
      origin: { kind: "method-source", path: methodSource({ kind: "agent", within: "aidlc-pipeline-deploy-agent.md" }) } },
  ]));
});

test.each(cases)("real plugin serialization supplies its own policy class alongside $ending pipeline source", ({ surfaced, text }) => {
  const flow = composed(surfaced);
  expect(flow.release.replacements).toHaveLength(2);
  expect(nativeLayoutFiles({ host: identity, routes, release: flow.release, files: flow.pluginFiles })).toEqual(accepted([
    { path: path(".kiro/tools/data/harness.json"), content: { kind: "text", text: EXPECTED_DESCRIPTOR }, mode: "regular",
      origin: { kind: "rendered", concept: "host-data", name: "kiro-ide" } },
    { path: path(".kiro/tools/data/plugin-agent.md"), content: { kind: "text", text: EXPECTED_PLUGIN }, mode: "regular",
      origin: { kind: "rendered", concept: "host-data", name: "kiro-ide" } },
    { path: path(".kiro/agents/aidlc-pipeline-deploy-agent.md"), content: { kind: "text", text }, mode: "regular",
      origin: { kind: "method-source", path: methodSource({ kind: "agent", within: "aidlc-pipeline-deploy-agent.md" }) } },
  ]));
});
