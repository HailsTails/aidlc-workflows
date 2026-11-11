import { claudeDistribution } from "../hosts/claude/distribution.ts";
import { CLAUDE_ONBOARDING_FILLS } from "../hosts/claude/onboarding-fills.ts";
import { claudeCommandPath } from "../hosts/claude/projection/command-renderer.ts";
import type { HostBuildMembers, HostBuildTable } from "./roots.ts";
import { kiroDistribution } from "../hosts/kiro/distribution.ts";
import { KIRO_ONBOARDING_FILLS } from "../hosts/kiro/onboarding-fills.ts";
import { kiroCommandPath } from "../hosts/kiro/projection/command-renderer.ts";
import { createCopilotDocumentRenderer } from "../hosts/copilot/projection/document-renderer.ts";
import { createCursorDocumentRenderer } from "../hosts/cursor/projection/document-renderer.ts";
import { cursorAgents } from "../hosts/cursor/projection/agent-renderer.ts";
import { COPILOT_SETTINGS_INPUTS, createCopilotSettingsRenderer } from "../hosts/copilot/projection/settings-renderer.ts";
import { createKiroIdeDocumentRenderer } from "../hosts/kiro-ide/projection/document-renderer.ts";
import { CURSOR_SETTINGS_INPUTS, createCursorSettingsRenderer } from "../hosts/cursor/projection/settings-renderer.ts";
import { codexAgents } from "../hosts/codex/projection/agent-renderer.ts";
import { openCodeAgents } from "../hosts/opencode/projection/agent-renderer.ts";
import { OPENCODE_SETTINGS_INPUTS, createOpenCodeSettingsRenderer } from "../hosts/opencode/projection/settings-renderer.ts";
import { kiroIdeAgents } from "../hosts/kiro-ide/projection/agent-renderer.ts";
import { KIRO_IDE_SETTINGS_INPUTS, createKiroIdeSettingsRenderer } from "../hosts/kiro-ide/projection/settings-renderer.ts";
import { createCodexDocumentRenderer } from "../hosts/codex/projection/document-renderer.ts";
import { createKiroDocumentRenderer } from "../hosts/kiro/projection/document-renderer.ts";
import { CODEX_SETTINGS_INPUTS, createCodexSettingsRenderer } from "../hosts/codex/projection/settings-renderer.ts";
import { claudeAgents } from "../hosts/claude/projection/agent-renderer.ts";
import { KIRO_SETTINGS_INPUTS, createKiroSettingsRenderer } from "../hosts/kiro/projection/settings-renderer.ts";
import { createClaudeDocumentRenderer } from "../hosts/claude/projection/document-renderer.ts";
import type { HostDocumentMembers } from "./roots.ts";
import { KIRO_IDE_AUTHORED_PLACEMENTS, KIRO_IDE_BINDING_HEADING } from "../hosts/kiro-ide/host-data.ts";
import { kiroIdeHostData } from "../hosts/kiro-ide/projection/host-data-renderer.ts";
import { COPILOT_HOST_DATA, COPILOT_AUTHORED_PLACEMENTS, COPILOT_BINDING_HEADING } from "../hosts/copilot/host-data.ts";
import { CURSOR_HOST_DATA, CURSOR_AUTHORED_PLACEMENTS, CURSOR_BINDING_HEADING } from "../hosts/cursor/host-data.ts";
import { CLAUDE_SETTINGS_INPUTS, createClaudeSettingsRenderer } from "../hosts/claude/projection/settings-renderer.ts";
import { OPENCODE_HOST_DATA, OPENCODE_AUTHORED_PLACEMENTS } from "../hosts/opencode/host-data.ts";
import { KIRO_HOST_DATA, KIRO_AUTHORED_PLACEMENTS, KIRO_BINDING_HEADING, KIRO_TOKENS, kiroHostIdentity } from "../hosts/kiro/host-data.ts";
import { CODEX_HOST_DATA, CODEX_AUTHORED_PLACEMENTS, CODEX_BINDING_HEADING } from "../hosts/codex/host-data.ts";
import { COPILOT_SKILL_INPUTS, createCopilotSkillRenderer } from "../hosts/copilot/projection/skill-renderer.ts";
import { CURSOR_SKILL_INPUTS, createCursorSkillRenderer } from "../hosts/cursor/projection/skill-renderer.ts";
import { KIRO_IDE_SKILL_INPUTS, createKiroIdeSkillRenderer } from "../hosts/kiro-ide/projection/skill-renderer.ts";
import {
  CLAUDE_HOST_DATA, CLAUDE_AUTHORED_PLACEMENTS, CLAUDE_BINDING_HEADING, CLAUDE_TOKENS, claudeHostIdentity,
} from "../hosts/claude/host-data.ts";
import { OPENCODE_SKILL_INPUTS, createOpenCodeSkillRenderer } from "../hosts/opencode/projection/skill-renderer.ts";
import { KIRO_SKILL_INPUTS, createKiroSkillRenderer } from "../hosts/kiro/projection/skill-renderer.ts";
import { CODEX_SKILL_INPUTS, createCodexSkillRenderer } from "../hosts/codex/projection/skill-renderer.ts";
import { createClaudeSkillRenderer } from "../hosts/claude/projection/skill-renderer.ts";
import { CLAUDE_SKILL_INPUTS } from "../hosts/claude/projection/skill-renderer.ts";
import type { HostIdentity } from "../kernel/host.ts";
import { accepted, refused, type Result } from "../kernel/result.ts";
import { sourcePath } from "../kernel/values.ts";
import { KIRO_AGENT_JSON, kiroAgents } from "../hosts/kiro/projection/json-agent-renderer.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";
import type { HostAgentMembers, HostSkillMembers, HostSurfaceMembers, HostSettingsMembers } from "./roots.ts";

const AGENT_MEMBERS = [
  { name: "cursor", inputs: [], render: cursorAgents },
  { name: "opencode", inputs: [], render: openCodeAgents },
  { name: "codex", inputs: [], render: codexAgents },
  { name: "kiro-ide", inputs: ["agents/aidlc-aidlc.md"], render: kiroIdeAgents },
  { name: "kiro", inputs: KIRO_AGENT_JSON, render: kiroAgents },
  { name: "claude", inputs: [], render: claudeAgents },
] as const;

export const hostAgentInputs = (name: string): readonly string[] =>
  AGENT_MEMBERS.find((entry) => entry.name === name)?.inputs ?? [];

export const hostAgentMembers = (host: HostIdentity):
Result<HostAgentMembers | null, ProjectionRefusal> => {
  const entry = AGENT_MEMBERS.find((candidate) => candidate.name === host.distribution);
  if (!entry) return accepted(null);
  const paths = entry.inputs.map(sourcePath);
  const failed = paths.find((path) => !path.ok);
  if (failed && !failed.ok) return refused({ kind: "render-failed", concept: "agent",
    name: host.distribution, reason: `The authored agent input is invalid: ${failed.refusal.raw}` });
  return accepted({ host, render: entry.render, inputs: paths.flatMap((path) => path.ok ? [path.value] : []) });
};
const HOST_SKILL_MEMBERS = [
  { name: "copilot", inputs: COPILOT_SKILL_INPUTS, render: createCopilotSkillRenderer },
  { name: "cursor", inputs: CURSOR_SKILL_INPUTS, render: createCursorSkillRenderer },
  { name: "kiro-ide", inputs: KIRO_IDE_SKILL_INPUTS, render: createKiroIdeSkillRenderer },
  { name: "opencode", inputs: OPENCODE_SKILL_INPUTS, render: createOpenCodeSkillRenderer },
  { name: "kiro", inputs: KIRO_SKILL_INPUTS, render: createKiroSkillRenderer },
  { name: "codex", inputs: CODEX_SKILL_INPUTS, render: createCodexSkillRenderer },
  { name: "claude", inputs: CLAUDE_SKILL_INPUTS, render: createClaudeSkillRenderer },
] as const;

export const hostSkillInputs = (name: string): readonly string[] =>
  HOST_SKILL_MEMBERS.find((entry) => entry.name === name)?.inputs ?? [];

export const hostSkillMembers = (host: HostIdentity): Result<HostSkillMembers | null, ProjectionRefusal> => {
  const entry = HOST_SKILL_MEMBERS.find((candidate) => candidate.name === host.distribution);
  if (!entry) return accepted(null);
  const paths = entry.inputs.map(sourcePath);
  const failed = paths.find((path) => !path.ok);
  if (failed && !failed.ok) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: failed.refusal.raw, reason: "The authored skill input is not a portable source path." });
  return accepted({ host, inputs: paths.flatMap((path) => path.ok ? [path.value] : []), render: entry.render });
};
const HOST_SURFACE_MEMBERS = [
  { name: "kiro-ide", renderData: kiroIdeHostData, placements: KIRO_IDE_AUTHORED_PLACEMENTS },
  { name: "copilot", renderData: () => COPILOT_HOST_DATA, placements: COPILOT_AUTHORED_PLACEMENTS },
  { name: "cursor", renderData: () => CURSOR_HOST_DATA, placements: CURSOR_AUTHORED_PLACEMENTS },
  { name: "opencode", renderData: () => OPENCODE_HOST_DATA, placements: OPENCODE_AUTHORED_PLACEMENTS },
  { name: "kiro", renderData: () => KIRO_HOST_DATA, placements: KIRO_AUTHORED_PLACEMENTS },
  { name: "codex", renderData: () => CODEX_HOST_DATA, placements: CODEX_AUTHORED_PLACEMENTS },
  { name: "claude", renderData: () => CLAUDE_HOST_DATA, placements: CLAUDE_AUTHORED_PLACEMENTS },
] as const;

export const hostSurfaceMembers = (host: HostIdentity): HostSurfaceMembers | null => {
  const entry = HOST_SURFACE_MEMBERS.find((candidate) => candidate.name === host.distribution);
  return entry ? { host, renderData: entry.renderData, placements: entry.placements } : null;
};

const HOST_SETTINGS_MEMBERS = [
  { name: "copilot", inputs: COPILOT_SETTINGS_INPUTS, render: createCopilotSettingsRenderer },
  { name: "cursor", inputs: CURSOR_SETTINGS_INPUTS, render: createCursorSettingsRenderer },
  { name: "opencode", inputs: OPENCODE_SETTINGS_INPUTS, render: createOpenCodeSettingsRenderer },
  { name: "kiro-ide", inputs: KIRO_IDE_SETTINGS_INPUTS, render: createKiroIdeSettingsRenderer },
  { name: "codex", inputs: CODEX_SETTINGS_INPUTS, render: createCodexSettingsRenderer },
  { name: "kiro", inputs: KIRO_SETTINGS_INPUTS, render: createKiroSettingsRenderer },
  { name: "claude", inputs: CLAUDE_SETTINGS_INPUTS, render: createClaudeSettingsRenderer },
] as const;

export const hostSettingsInputs = (name: string): readonly string[] =>
  HOST_SETTINGS_MEMBERS.find((entry) => entry.name === name)?.inputs ?? [];

export const hostSettingsMembers = (host: HostIdentity): Result<HostSettingsMembers | null, ProjectionRefusal> => {
  const entry = HOST_SETTINGS_MEMBERS.find((candidate) => candidate.name === host.distribution);
  if (!entry) return accepted(null);
  const paths = entry.inputs.map(sourcePath);
  const failed = paths.find((path) => !path.ok);
  if (failed && !failed.ok) return refused({ kind: "render-failed", concept: "settings",
    name: failed.refusal.raw, reason: "The authored settings input is not a portable source path." });
  return accepted({ host, inputs: paths.flatMap((path) => path.ok ? [path.value] : []), render: entry.render });
};

const HOST_BINDING_HEADINGS = [
  { name: "claude", heading: CLAUDE_BINDING_HEADING },
  { name: "kiro", heading: KIRO_BINDING_HEADING },
  { name: "kiro-ide", heading: KIRO_IDE_BINDING_HEADING },
  { name: "codex", heading: CODEX_BINDING_HEADING },
  { name: "cursor", heading: CURSOR_BINDING_HEADING },
  { name: "opencode", heading: "opencode" },
  { name: "copilot", heading: COPILOT_BINDING_HEADING },
] as const;

export const hostBindingHeadings = (): readonly string[] => HOST_BINDING_HEADINGS.map((entry) => entry.heading);

export const BINDING_HEADINGS: Readonly<Record<string, string>> = Object.fromEntries(
  HOST_BINDING_HEADINGS.map((entry) => [entry.name, entry.heading]),
);

const HOST_DOCUMENT_MEMBERS = [
  { name: "copilot", inputs: [], render: createCopilotDocumentRenderer },
  { name: "cursor", inputs: [], render: createCursorDocumentRenderer },
  { name: "kiro-ide", inputs: [], render: createKiroIdeDocumentRenderer },
  { name: "codex", inputs: [], render: createCodexDocumentRenderer },
  { name: "kiro", inputs: [], render: createKiroDocumentRenderer },
  { name: "claude", inputs: [], render: createClaudeDocumentRenderer },
] as const;

export const hostDocumentMembers = (host: HostIdentity): HostDocumentMembers | null => {
  const entry = HOST_DOCUMENT_MEMBERS.find((candidate) => candidate.name === host.distribution);
  return entry ? { host, inputs: entry.inputs, render: entry.render } : null;
};

type HostEntry = {
  readonly identity: () => Result<HostIdentity, unknown>;
  readonly tokens: HostBuildMembers["tokens"];
  readonly commands: HostBuildMembers["commands"];
  readonly fills: HostBuildMembers["fills"];
  readonly bindingHeading: string;
  readonly distribution: NonNullable<HostBuildMembers["distribution"]>;
};

const ROUTED_ENTRIES: readonly HostEntry[] = [
  { identity: claudeHostIdentity, tokens: CLAUDE_TOKENS, commands: claudeCommandPath,
    fills: CLAUDE_ONBOARDING_FILLS, bindingHeading: CLAUDE_BINDING_HEADING, distribution: claudeDistribution },
  { identity: kiroHostIdentity, tokens: KIRO_TOKENS, commands: kiroCommandPath,
    fills: KIRO_ONBOARDING_FILLS, bindingHeading: KIRO_BINDING_HEADING, distribution: kiroDistribution },
];

const buildMembers = (entry: HostEntry): HostBuildTable => {
  const identity = entry.identity();
  if (!identity.ok) return [];
  const host = identity.value;
  const agents = hostAgentMembers(host);
  const skills = hostSkillMembers(host);
  const settings = hostSettingsMembers(host);
  const documents = hostDocumentMembers(host);
  const surface = hostSurfaceMembers(host);
  if (!agents.ok || !skills.ok || !settings.ok || agents.value === null || skills.value === null ||
    settings.value === null || documents === null || surface === null) return [];
  return [{ host, tokens: entry.tokens, renderData: surface.renderData, placements: surface.placements,
    agents: agents.value, skills: skills.value, settings: settings.value, documents,
    commands: entry.commands, fills: entry.fills, bindingHeading: entry.bindingHeading,
    distribution: entry.distribution }];
};

export const HOST_BUILD_MEMBERS: HostBuildTable = ROUTED_ENTRIES.flatMap(buildMembers);
