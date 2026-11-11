import { createOpenCodeDocumentRenderer } from "../hosts/opencode/projection/document-renderer.ts";
import { COPILOT_ONBOARDING_FILLS } from "../hosts/copilot/onboarding-fills.ts";
import { copilotDistribution } from "../hosts/copilot/distribution.ts";
import { OPENCODE_ONBOARDING_FILLS } from "../hosts/opencode/onboarding-fills.ts";
import { openCodeDistribution } from "../hosts/opencode/distribution.ts";
import { KIRO_IDE_ONBOARDING_FILLS } from "../hosts/kiro-ide/onboarding-fills.ts";
import { kiroIdeDistribution } from "../hosts/kiro-ide/distribution.ts";
import { CODEX_ONBOARDING_FILLS } from "../hosts/codex/onboarding-fills.ts";
import { codexDistribution } from "../hosts/codex/distribution.ts";
import { CURSOR_ONBOARDING_FILLS } from "../hosts/cursor/onboarding-fills.ts";
import { cursorDistribution } from "../hosts/cursor/distribution.ts";
import { KIRO_ONBOARDING_FILLS } from "../hosts/kiro/onboarding-fills.ts";
import { kiroDistribution } from "../hosts/kiro/distribution.ts";
import { CLAUDE_ONBOARDING_FILLS } from "../hosts/claude/onboarding-fills.ts";
import { claudeDistribution } from "../hosts/claude/distribution.ts";
import { createCopilotDocumentRenderer } from "../hosts/copilot/projection/document-renderer.ts";
import { createCursorDocumentRenderer } from "../hosts/cursor/projection/document-renderer.ts";
import { cursorAgents } from "../hosts/cursor/projection/agent-renderer.ts";
import { createCopilotSettingsRenderer } from "../hosts/copilot/projection/settings-renderer.ts";
import { createKiroIdeDocumentRenderer } from "../hosts/kiro-ide/projection/document-renderer.ts";
import { createCursorSettingsRenderer } from "../hosts/cursor/projection/settings-renderer.ts";
import { codexAgents } from "../hosts/codex/projection/agent-renderer.ts";
import { openCodeAgents } from "../hosts/opencode/projection/agent-renderer.ts";
import { createOpenCodeSettingsRenderer } from "../hosts/opencode/projection/settings-renderer.ts";
import { createKiroIdeSettingsRenderer } from "../hosts/kiro-ide/projection/settings-renderer.ts";
import { createCodexDocumentRenderer } from "../hosts/codex/projection/document-renderer.ts";
import { createCodexSettingsRenderer } from "../hosts/codex/projection/settings-renderer.ts";
import { documentRenderingInputsFixture } from "../projection/fixtures/document-rendering.fixture.ts";
import { expect, test } from "bun:test";
import { host, path, source } from "../kernel/fixtures/values.fixture.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { accepted, refused } from "../kernel/result.ts";
import { CLAUDE_TOKENS, claudeHostIdentity } from "../hosts/claude/host-data.ts";
import { claudeCommandPath } from "../hosts/claude/projection/command-renderer.ts";
import { SCRATCH_AGENT_INPUTS } from "../projection/fixtures/scratch-host.fixture.ts";
import { agent } from "../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../workflow-definition/fixtures/method-source.fixture.ts";
import {
  HOST_BUILD_MEMBERS, HOST_BUILD_REFUSALS, hostBuildMembers, type HostEntry, hostBindingHeadings, hostDocumentMembers, hostAgentInputs, hostAgentMembers, hostSurfaceMembers,
  hostSettingsInputs, hostSettingsMembers } from "./host-table.ts";
import { createKiroSettingsRenderer } from "../hosts/kiro/projection/settings-renderer.ts";

test("Cursor agents register the native factory without an authored host input", () => {
  const cursor = host({ name: "cursor", directory: ".cursor" });
  expect(hostAgentInputs("cursor")).toEqual([]);
  expect(hostAgentMembers(cursor)).toEqual({ ok: true, value: { host: cursor, inputs: [], render: cursorAgents } });
});

test("Copilot documents directly register the native combined factory without authored capture", () => {
  const copilot = host({ name: "copilot", directory: ".aidlc" });
  expect(hostDocumentMembers(copilot)).toEqual({ host: copilot, inputs: [], render: createCopilotDocumentRenderer });
});

test("Cursor documents directly register the native factory with no authored capture", () => {
  const cursor = host({ name: "cursor", directory: ".cursor" });
  expect(hostDocumentMembers(cursor)).toEqual({ host: cursor, inputs: [], render: createCursorDocumentRenderer });
});

test("Copilot settings register the native hooks factory without authored capture", () => {
  const copilot = host({ name: "copilot", directory: ".aidlc" });
  expect(hostSettingsInputs("copilot")).toEqual([]);
  expect(hostSettingsMembers(copilot)).toEqual({ ok: true, value: {
    host: copilot, inputs: [], render: createCopilotSettingsRenderer,
  } });
});

test("Kiro IDE documents directly register the native factory with no authored capture", () => {
  const kiroIde = host({ name: "kiro-ide", directory: ".kiro" });
  expect(hostDocumentMembers(kiroIde)).toEqual({ host: kiroIde, inputs: [], render: createKiroIdeDocumentRenderer });
  expect(hostBindingHeadings()).toEqual([
    "Claude Code", "Kiro CLI", "Kiro IDE", "Codex CLI", "Cursor", "opencode", "GitHub Copilot",
  ]);
});

test("an unregistered host has no agent inputs or accidental Kiro members", () => {
  expect(hostAgentInputs("fixture-host")).toEqual([]);
  expect(hostAgentMembers(host({ name: "fixture-host", directory: ".fixture" })))
    .toEqual({ ok: true, value: null });
});

test("the Kiro table captures the conductor and every native persona", () => {
  expect(hostAgentInputs("kiro")).toEqual([
    "agents/aidlc.json", "agents/aidlc-architect-agent.json", "agents/aidlc-developer-agent.json",
    "agents/aidlc-product-lead-agent.json", "agents/aidlc-architecture-reviewer-agent.json",
    "agents/aidlc-composer-agent.json", "agents/aidlc-product-agent.json", "agents/aidlc-design-agent.json",
    "agents/aidlc-delivery-agent.json", "agents/aidlc-aws-platform-agent.json",
    "agents/aidlc-compliance-agent.json", "agents/aidlc-devsecops-agent.json",
    "agents/aidlc-quality-agent.json", "agents/aidlc-pipeline-deploy-agent.json",
    "agents/aidlc-operations-agent.json",
  ]);
});
test("the Kiro IDE host table uses policy-rendered data and the four remaining native placements", () => {
  const members = hostSurfaceMembers(host({ name: "kiro-ide", directory: ".kiro" }));
  expect(members).not.toBeNull();
  expect(members?.placements).toEqual([
    { source: "steering/aidlc-active-memory.md", destination: ".kiro/steering/aidlc-active-memory.md" },
    { source: "hooks/aidlc-kiro-adapter.ts", destination: ".kiro/hooks/aidlc-kiro-adapter.ts" },
    { source: "hooks/aidlc-kiro-tool-names.ts", destination: ".kiro/hooks/aidlc-kiro-tool-names.ts" },
    { source: "dot-gitignore", destination: ".gitignore" },
  ]);
  const hostData = members?.renderData({ delegateShellFacts: {
    engineNamespace: "engine", engineRoutes: [], dispatcherCommands: ["--fixture"], launcherGlobalFlags: [],
    workspaceNouns: [], workspaceRead: () => "other", admittedVerbs: () => ({}),
    engineRouteAdmission: () => "refused", lifecycleAdmission: () => "admitted", trustedCommand: () => "unused",
  } });
  expect(hostData?.productName).toBe("Kiro");
  expect(hostData?.pluginAgentFrontmatter?.copy).toContain('        - "bun .kiro/tools/aidlc.ts --fixture"');
  expect(hostData?.pluginAgentFrontmatter?.native).toEqual(hostData?.pluginAgentFrontmatter?.copy);
});

test("host composition preserves the legacy binding refusal and missing-heading order", () => {
  const renderer = hostDocumentMembers(host({ name: "claude", directory: ".claude" }))
    ?.render(documentRenderingInputsFixture({ harnessDir: ".claude" }));
  expect(renderer?.placeNeutralDocument({ document: {
    source: source("aidlc-common/protocols/missing.md"), role: "protocol",
    content: { kind: "text", text: "### Claude Code\nOnly\n" },
  } })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "neutral-document",
    name: "aidlc-common/protocols/missing.md",
    reason: "harness bindings: aidlc-common/protocols/missing.md line 1: a binding run must name each tool once " +
      "(found Claude Code; missing Kiro CLI, Kiro IDE, Codex CLI, Cursor, opencode, GitHub Copilot).",
  } });
});

test("Kiro settings capture exactly its CLI settings and two shipped hook registrations", () => {
  expect(hostSettingsInputs("kiro")).toEqual([
    "settings/cli.json", "hooks/aidlc-record-human-turn.kiro.hook", "hooks/aidlc-plan-approval-guard.kiro.hook",
  ]);
  const kiro = host({ name: "kiro", directory: ".kiro" });
  expect(hostSettingsMembers(kiro)).toEqual({ ok: true, value: { host: kiro, render: createKiroSettingsRenderer,
    inputs: [source("settings/cli.json"), source("hooks/aidlc-record-human-turn.kiro.hook"),
      source("hooks/aidlc-plan-approval-guard.kiro.hook")],
  } });
});

test("Kiro IDE settings and conductor have distinct native members", () => {
  const ide = host({ name: "kiro-ide", directory: ".kiro" });
  expect(hostSettingsInputs("kiro-ide")).toEqual([
    "settings/cli.json", "hooks/aidlc-record-human-turn.json", "hooks/aidlc-guard-tool-call.json",
    "hooks/aidlc-log-subagent.json", "hooks/aidlc-session-start.json", "hooks/aidlc-continue-workflow.json",
  ]);
  expect(hostSettingsMembers(ide)).toEqual({ ok: true, value: { host: ide, render: createKiroIdeSettingsRenderer,
    inputs: [source("settings/cli.json"), source("hooks/aidlc-record-human-turn.json"),
      source("hooks/aidlc-guard-tool-call.json"), source("hooks/aidlc-log-subagent.json"),
      source("hooks/aidlc-session-start.json"), source("hooks/aidlc-continue-workflow.json")],
  } });
  expect(hostAgentInputs("kiro-ide")).toEqual(["agents/aidlc-aidlc.md"]);
  expect(hostAgentMembers(ide)).toEqual({ ok: true, value: {
    host: ide, inputs: [source("agents/aidlc-aidlc.md")], render: expect.any(Function),
  } });
});

test("the Kiro IDE composition binds its persona port to the real Kiro renderer", () => {
  const members = accept(hostAgentMembers(host({ name: "kiro-ide", directory: ".kiro" })));
  const rendering = members?.render({ ...SCRATCH_AGENT_INPUTS,
    host: host({ name: "kiro-ide", directory: ".kiro" }),
    inlineAgents: new Set([agent("aidlc-architect-agent")]),
    documents: () => ({ ok: true, value: "---\nname: architect\n---\nPersona\n" }),
  });
  expect(rendering?.renderAgent({ agent: {
    slug: agent("aidlc-architect-agent"), source: methodSource({ kind: "agent", within: "aidlc-architect-agent.md" }),
    displayName: "Architect", description: "Architecture", owner: { kind: "core" },
    model: { kind: "tier", tier: "judgment" }, examples: [], tools: { disallowed: ["Task"] }, maxTurns: null,
    persona: { text: "# Architect\n", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
  }, knowledge: [] })).toEqual({ ok: true, value: [
    { path: path(".kiro/agents/aidlc-architect-agent.md"), mode: "regular", availability: "always",
      origin: { kind: "method-source", path: methodSource({ kind: "agent", within: "aidlc-architect-agent.md" }) },
      content: { kind: "text", text: expect.stringContaining('tools: ["read", "write", "shell"]\nincludeMcpJson: true\npermissions:\n') } },
    { path: path(".kiro/aidlc-common/personas/aidlc-architect-agent.md"), mode: "regular", availability: "always",
      origin: { kind: "method-source", path: methodSource({ kind: "agent", within: "aidlc-architect-agent.md" }) },
      content: { kind: "text", text: "---\nname: architect\n---\nPersona\n" } },
  ] });
});

import { claudeAgents } from "../hosts/claude/projection/agent-renderer.ts";

test("Claude uses the native agent factory with captured Method sources and no authored host agent input", () => {
  const identity = host({ name: "claude", directory: ".claude" });
  expect(hostAgentInputs("claude")).toEqual([]);
  expect(hostAgentMembers(identity)).toEqual({ ok: true, value: { host: identity, render: claudeAgents, inputs: [] } });
});

test("the Codex settings table registers its native factory without authored files", () => {
  const codex = host({ name: "codex", directory: ".codex" });
  expect(hostSettingsInputs("codex")).toEqual([]);
  expect(hostSettingsMembers(codex)).toEqual({ ok: true, value: {
    host: codex, inputs: [], render: createCodexSettingsRenderer,
  } });
  expect(hostSettingsMembers(host({ name: "fixture-host", directory: ".fixture" })))
    .toEqual({ ok: true, value: null });
});

test("the documents root receives every registered binding heading", () => {
  expect(hostBindingHeadings()).toEqual([
    "Claude Code", "Kiro CLI", "Kiro IDE", "Codex CLI", "Cursor", "opencode", "GitHub Copilot",
  ]);
});

test("Kiro documents are registered with no authored capture and the shared heading vocabulary", () => {
  const members = hostDocumentMembers(host({ name: "kiro", directory: ".kiro" }));
  expect(members?.inputs).toEqual([]);
  const renderer = members?.render(documentRenderingInputsFixture({ harnessDir: ".kiro" }));
  expect(renderer?.placeNeutralDocument({ document: {
    source: source("aidlc-common/protocols/missing.md"), role: "protocol",
    content: { kind: "text", text: "### Kiro CLI\nOnly\n" },
  } })).toEqual({ ok: false, refusal: { kind: "render-failed", concept: "neutral-document",
    name: "aidlc-common/protocols/missing.md",
    reason: "harness bindings: aidlc-common/protocols/missing.md line 1: a binding run must name each tool once " +
      "(found Kiro CLI; missing Claude Code, Kiro IDE, Codex CLI, Cursor, opencode, GitHub Copilot).",
  } });
});

test("Codex documents directly register the native renderer without authored capture", () => {
  const codex = host({ name: "codex", directory: ".codex" });
  expect(hostDocumentMembers(codex)).toEqual({ host: codex, inputs: [], render: createCodexDocumentRenderer });
});

test("OpenCode settings register the native settings and captured plugin producer", () => {
  const opencode = host({ name: "opencode", directory: ".aidlc" });
  expect(hostSettingsInputs("opencode")).toEqual(["opencode.json", "plugin/aidlc-opencode-adapter.ts"]);
  expect(hostSettingsMembers(opencode)).toEqual({ ok: true, value: {
    host: opencode, inputs: [source("opencode.json"), source("plugin/aidlc-opencode-adapter.ts")],
    render: createOpenCodeSettingsRenderer,
  } });
});

test("Claude, Kiro, Codex, Cursor, Kiro IDE, OpenCode and Copilot enter the full table with every real concept, fills and distribution", () => {
  expect(HOST_BUILD_MEMBERS).toHaveLength(7);
  expect(HOST_BUILD_MEMBERS[0]?.host).toEqual(host({ name: "claude", directory: ".claude" }));
  expect(HOST_BUILD_MEMBERS[1]?.host).toEqual(host({ name: "kiro", directory: ".kiro" }));
  expect(HOST_BUILD_MEMBERS[2]?.host).toEqual(host({ name: "codex", directory: ".codex" }));
  expect(HOST_BUILD_MEMBERS[3]?.host).toEqual(host({ name: "cursor", directory: ".cursor" }));
  expect(HOST_BUILD_MEMBERS[4]?.host).toEqual(host({ name: "kiro-ide", directory: ".kiro" }));
  expect(HOST_BUILD_MEMBERS[5]?.host).toEqual(host({ name: "opencode", directory: ".aidlc" }));
  expect(HOST_BUILD_MEMBERS[6]?.host).toEqual(host({ name: "copilot", directory: ".aidlc" }));
  expect(HOST_BUILD_MEMBERS[0]?.fills).toBe(CLAUDE_ONBOARDING_FILLS);
  expect(HOST_BUILD_MEMBERS[0]?.distribution).toBe(claudeDistribution);
  expect(HOST_BUILD_MEMBERS[0]?.bindingHeading).toBe("Claude Code");
  expect(HOST_BUILD_MEMBERS[1]?.fills).toBe(KIRO_ONBOARDING_FILLS);
  expect(HOST_BUILD_MEMBERS[1]?.distribution).toBe(kiroDistribution);
  expect(HOST_BUILD_MEMBERS[1]?.bindingHeading).toBe("Kiro CLI");
  expect(HOST_BUILD_MEMBERS[2]?.fills).toBe(CODEX_ONBOARDING_FILLS);
  expect(HOST_BUILD_MEMBERS[2]?.distribution).toBe(codexDistribution);
  expect(HOST_BUILD_MEMBERS[2]?.bindingHeading).toBe("Codex CLI");
  expect(HOST_BUILD_MEMBERS[3]?.fills).toBe(CURSOR_ONBOARDING_FILLS);
  expect(HOST_BUILD_MEMBERS[3]?.distribution).toBe(cursorDistribution);
  expect(HOST_BUILD_MEMBERS[3]?.bindingHeading).toBe("Cursor");
  expect(HOST_BUILD_MEMBERS[4]?.fills).toBe(KIRO_IDE_ONBOARDING_FILLS);
  expect(HOST_BUILD_MEMBERS[4]?.distribution).toBe(kiroIdeDistribution);
  expect(HOST_BUILD_MEMBERS[4]?.bindingHeading).toBe("Kiro IDE");
  expect(HOST_BUILD_MEMBERS[5]?.fills).toBe(OPENCODE_ONBOARDING_FILLS);
  expect(HOST_BUILD_MEMBERS[5]?.distribution).toBe(openCodeDistribution);
  expect(HOST_BUILD_MEMBERS[5]?.bindingHeading).toBe("opencode");
  expect(HOST_BUILD_MEMBERS[6]?.fills).toBe(COPILOT_ONBOARDING_FILLS);
  expect(HOST_BUILD_MEMBERS[6]?.distribution).toBe(copilotDistribution);
  expect(HOST_BUILD_MEMBERS[6]?.bindingHeading).toBe("GitHub Copilot");
});

test("Codex agents directly register the native factory without authored capture", () => {
  const codex = host({ name: "codex", directory: ".codex" });
  expect(hostAgentInputs("codex")).toEqual([]);
  expect(hostAgentMembers(codex)).toEqual({ ok: true, value: {
    host: codex, inputs: [], render: codexAgents,
  } });
});

test("Cursor settings capture only its authored CLI settings and hook registration", () => {
  const cursor = host({ name: "cursor", directory: ".cursor" });
  expect(hostSettingsInputs("cursor")).toEqual(["cli.json", "hooks.json"]);
  expect(hostSettingsMembers(cursor)).toEqual({ ok: true, value: {
    host: cursor, inputs: [source("cli.json"), source("hooks.json")], render: createCursorSettingsRenderer,
  } });
});

test("OpenCode agents directly register the native factory without authored capture", () => {
  const opencode = host({ name: "opencode", directory: ".aidlc" });
  expect(hostAgentInputs("opencode")).toEqual([]);
  expect(hostAgentMembers(opencode)).toEqual({ ok: true, value: {
    host: opencode, inputs: [], render: openCodeAgents,
  } });
});

test("OpenCode documents directly register the native renderer without authored capture", () => {
  const opencode = host({ name: "opencode", directory: ".aidlc" });
  expect(hostDocumentMembers(opencode)).toEqual({ host: opencode, inputs: [], render: createOpenCodeDocumentRenderer });
});

const claudeEntry: HostEntry = {
  identity: claudeHostIdentity, tokens: CLAUDE_TOKENS, commands: claudeCommandPath,
  fills: CLAUDE_ONBOARDING_FILLS, bindingHeading: "Claude Code", distribution: claudeDistribution,
};

test("every routed host builds, so the table reports no refusals", () => {
  expect(HOST_BUILD_REFUSALS).toEqual([]);
});

test("a host entry whose identity refuses names the identity member and keeps the identity's own refusal", () => {
  const identityRefusal = { kind: "invalid-distribution-id", raw: "" };
  expect(hostBuildMembers({ ...claudeEntry, identity: () => refused(identityRefusal) })).toEqual(refused({
    kind: "host-build-refused", member: "identity", host: null, reason: identityRefusal }));
});

test("a host with no registered members names the first missing member and the host", () => {
  const scratch = host({ name: "scratch", directory: ".scratch" });
  expect(hostBuildMembers({ ...claudeEntry, identity: () => accepted(scratch) })).toEqual(refused({
    kind: "host-build-refused", member: "agents", host: "scratch",
    reason: "No members are registered for this host in the host table." }));
});

test("a complete host entry is accepted with its identity", () => {
  const built = hostBuildMembers(claudeEntry);
  expect(built.ok && built.value.host).toEqual(host({ name: "claude", directory: ".claude" }));
});
