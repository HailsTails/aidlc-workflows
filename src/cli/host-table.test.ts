import { documentRenderingInputsFixture } from "../projection/fixtures/document-rendering.fixture.ts";
import { expect, test } from "bun:test";
import { host, source } from "../kernel/fixtures/values.fixture.ts";
import { hostDocumentMembers, hostAgentInputs, hostAgentMembers, hostSurfaceMembers,
  hostSettingsInputs, hostSettingsMembers } from "./host-table.ts";
import { createKiroSettingsRenderer } from "../hosts/kiro/projection/settings-renderer.ts";

test("an unregistered host has no agent inputs or accidental Kiro members", () => {
  expect(hostAgentInputs("claude")).toEqual([]);
  expect(hostAgentMembers(host({ name: "claude", directory: ".claude" })))
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
test("the Kiro IDE host table uses policy-rendered data and all five native placements", () => {
  const members = hostSurfaceMembers(host({ name: "kiro-ide", directory: ".kiro" }));
  expect(members).not.toBeNull();
  expect(members?.placements).toEqual([
    { source: "steering/aidlc-active-memory.md", destination: ".kiro/steering/aidlc-active-memory.md" },
    { source: "agents/aidlc-aidlc.md", destination: ".kiro/agents/aidlc-aidlc.md" },
    { source: "hooks/aidlc-kiro-adapter.ts", destination: ".kiro/hooks/aidlc-kiro-adapter.ts" },
    { source: "hooks/aidlc-kiro-tool-names.ts", destination: ".kiro/hooks/aidlc-kiro-tool-names.ts" },
    { source: "dot-gitignore", destination: ".gitignore" },
  ]);
  const hostData = members?.renderData({ delegateShell: {
    shellDeny: (agent) => [`policy for ${agent}`], riskyForms: ["|"] } });
  expect(hostData?.productName).toBe("Kiro");
  expect(hostData?.pluginAgentFrontmatter?.copy).toContain("policy for plugin-agent");
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

test("the Kiro CLI settings registration does not claim the Kiro IDE route", () => {
  expect(hostSettingsInputs("kiro-ide")).toEqual([]);
  expect(hostSettingsMembers(host({ name: "kiro-ide", directory: ".kiro" })))
    .toEqual({ ok: true, value: null });
});
