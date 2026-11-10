import { createCopilotSettingsRenderer } from "../hosts/copilot/projection/settings-renderer.ts";
import { createKiroIdeDocumentRenderer } from "../hosts/kiro-ide/projection/document-renderer.ts";
import { createCursorSettingsRenderer } from "../hosts/cursor/projection/settings-renderer.ts";
import { codexAgents } from "../hosts/codex/projection/agent-renderer.ts";
import { openCodeAgents } from "../hosts/opencode/projection/agent-renderer.ts";
import { createOpenCodeSettingsRenderer } from "../hosts/opencode/projection/settings-renderer.ts";
import { kiroIdeAgents } from "../hosts/kiro-ide/projection/agent-renderer.ts";
import { createKiroIdeSettingsRenderer } from "../hosts/kiro-ide/projection/settings-renderer.ts";
import { createCodexDocumentRenderer } from "../hosts/codex/projection/document-renderer.ts";
import { createCodexSettingsRenderer } from "../hosts/codex/projection/settings-renderer.ts";
import { documentRenderingInputsFixture } from "../projection/fixtures/document-rendering.fixture.ts";
import { expect, test } from "bun:test";
import { host, source } from "../kernel/fixtures/values.fixture.ts";
import { hostBindingHeadings, hostDocumentMembers, hostAgentInputs, hostAgentMembers, hostSurfaceMembers,
  hostSettingsInputs, hostSettingsMembers } from "./host-table.ts";
import { createKiroSettingsRenderer } from "../hosts/kiro/projection/settings-renderer.ts";

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
    host: ide, inputs: [source("agents/aidlc-aidlc.md")], render: kiroIdeAgents,
  } });
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
