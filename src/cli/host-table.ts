import { claudeDistribution } from "../hosts/claude/distribution.ts";
import { CLAUDE_ONBOARDING_FILLS } from "../hosts/claude/onboarding-fills.ts";
import { claudeCommandPath } from "../hosts/claude/projection/command-renderer.ts";
import type { HostBuildMembers, HostBuildTable } from "./roots.ts";
import { codexDistribution } from "../hosts/codex/distribution.ts";
import { CODEX_ONBOARDING_FILLS } from "../hosts/codex/onboarding-fills.ts";
import { codexCommandPath } from "../hosts/codex/projection/command-renderer.ts";
import { cursorDistribution } from "../hosts/cursor/distribution.ts";
import { CURSOR_ONBOARDING_FILLS } from "../hosts/cursor/onboarding-fills.ts";
import { cursorCommandPath } from "../hosts/cursor/projection/command-renderer.ts";
import { kiroIdeDistribution } from "../hosts/kiro-ide/distribution.ts";
import { openCodeCommandPath } from "../hosts/opencode/projection/command-renderer.ts";
import { copilotCommandPath } from "../hosts/copilot/projection/command-renderer.ts";
import { copilotDistribution } from "../hosts/copilot/distribution.ts";
import { COPILOT_ONBOARDING_FILLS } from "../hosts/copilot/onboarding-fills.ts";
import { openCodeDistribution } from "../hosts/opencode/distribution.ts";
import { OPENCODE_ONBOARDING_FILLS } from "../hosts/opencode/onboarding-fills.ts";
import { KIRO_IDE_ONBOARDING_FILLS } from "../hosts/kiro-ide/onboarding-fills.ts";
import { kiroIdeCommandPath } from "../hosts/kiro-ide/projection/command-renderer.ts";
import { kiroDistribution } from "../hosts/kiro/distribution.ts";
import { KIRO_ONBOARDING_FILLS } from "../hosts/kiro/onboarding-fills.ts";
import { kiroCommandPath } from "../hosts/kiro/projection/command-renderer.ts";
import { createCopilotDocumentRenderer } from "../hosts/copilot/projection/document-renderer.ts";
import { createOpenCodeDocumentRenderer } from "../hosts/opencode/projection/document-renderer.ts";
import { createCursorDocumentRenderer } from "../hosts/cursor/projection/document-renderer.ts";
import { cursorAgents } from "../hosts/cursor/projection/agent-renderer.ts";
import { COPILOT_SETTINGS_INPUTS, createCopilotSettingsRenderer } from "../hosts/copilot/projection/settings-renderer.ts";
import { createKiroIdeDocumentRenderer } from "../hosts/kiro-ide/projection/document-renderer.ts";
import { CURSOR_SETTINGS_INPUTS, createCursorSettingsRenderer } from "../hosts/cursor/projection/settings-renderer.ts";
import { codexAgents } from "../hosts/codex/projection/agent-renderer.ts";
import { openCodeAgents } from "../hosts/opencode/projection/agent-renderer.ts";
import { OPENCODE_SETTINGS_INPUTS, createOpenCodeSettingsRenderer } from "../hosts/opencode/projection/settings-renderer.ts";
import { createKiroIdeAgents } from "../hosts/kiro-ide/projection/agent-renderer.ts";
import { kiroAgentRenderer } from "../hosts/kiro/projection/agent-renderer.ts";
import { KIRO_IDE_SETTINGS_INPUTS, createKiroIdeSettingsRenderer } from "../hosts/kiro-ide/projection/settings-renderer.ts";
import { createCodexDocumentRenderer } from "../hosts/codex/projection/document-renderer.ts";
import { createKiroDocumentRenderer } from "../hosts/kiro/projection/document-renderer.ts";
import { CODEX_SETTINGS_INPUTS, createCodexSettingsRenderer } from "../hosts/codex/projection/settings-renderer.ts";
import { claudeAgents } from "../hosts/claude/projection/agent-renderer.ts";
import { KIRO_SETTINGS_INPUTS, createKiroSettingsRenderer } from "../hosts/kiro/projection/settings-renderer.ts";
import { createClaudeDocumentRenderer } from "../hosts/claude/projection/document-renderer.ts";
import type { HostDocumentMembers } from "./roots.ts";
import {
  KIRO_IDE_AUTHORED_PLACEMENTS, KIRO_IDE_BINDING_HEADING, KIRO_IDE_TOKENS, kiroIdeHostIdentity,
} from "../hosts/kiro-ide/host-data.ts";
import { kiroIdeHostData } from "../hosts/kiro-ide/projection/host-data-renderer.ts";
import {
  COPILOT_HOST_DATA, COPILOT_AUTHORED_PLACEMENTS, COPILOT_BINDING_HEADING, COPILOT_TOKENS, copilotHostIdentity,
} from "../hosts/copilot/host-data.ts";
import {
  CURSOR_HOST_DATA, CURSOR_AUTHORED_PLACEMENTS, CURSOR_BINDING_HEADING, CURSOR_TOKENS, cursorHostIdentity,
} from "../hosts/cursor/host-data.ts";
import { CLAUDE_SETTINGS_INPUTS, createClaudeSettingsRenderer } from "../hosts/claude/projection/settings-renderer.ts";
import { OPENCODE_HOST_DATA, OPENCODE_AUTHORED_PLACEMENTS, OPENCODE_BINDING_HEADING, OPENCODE_TOKENS, openCodeHostIdentity } from "../hosts/opencode/host-data.ts";
import { KIRO_HOST_DATA, KIRO_AUTHORED_PLACEMENTS, KIRO_BINDING_HEADING, KIRO_TOKENS, kiroHostIdentity } from "../hosts/kiro/host-data.ts";
import {
  CODEX_HOST_DATA, CODEX_AUTHORED_PLACEMENTS, CODEX_BINDING_HEADING, CODEX_TOKENS, codexHostIdentity,
} from "../hosts/codex/host-data.ts";
import { COPILOT_SKILL_INPUTS, createCopilotSkillRenderer } from "../hosts/copilot/projection/skill-renderer.ts";
import { CURSOR_SKILL_INPUTS, createCursorSkillRenderer } from "../hosts/cursor/projection/skill-renderer.ts";
import { KIRO_IDE_SKILL_INPUTS, createKiroIdeSkillRenderer } from "../hosts/kiro-ide/projection/skill-renderer.ts";
import {
  CLAUDE_HOST_DATA, CLAUDE_AUTHORED_PLACEMENTS, CLAUDE_BINDING_HEADING, CLAUDE_TOKENS, claudeHostIdentity,
} from "../hosts/claude/host-data.ts";
import { OPENCODE_SKILL_INPUTS, createOpenCodeSkillRenderer } from "../hosts/opencode/projection/skill-renderer.ts";
import { KIRO_SKILL_INPUTS, createKiroSkillRenderer } from "../hosts/kiro/projection/skill-renderer.ts";
import { CODEX_SKILL_INPUTS, createCodexSkillRenderer } from "../hosts/codex/projection/skill-renderer.ts";
import { copilotAgents } from "../hosts/copilot/projection/agent-renderer.ts";
import { createClaudeSkillRenderer } from "../hosts/claude/projection/skill-renderer.ts";
import { CLAUDE_SKILL_INPUTS } from "../hosts/claude/projection/skill-renderer.ts";
import type { HostIdentity } from "../kernel/host.ts";
import { accepted, refused, type Result } from "../kernel/result.ts";
import { sourcePath } from "../kernel/values.ts";
import { KIRO_AGENT_JSON, kiroAgents } from "../hosts/kiro/projection/json-agent-renderer.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";
import type { HostAgentMembers, HostSkillMembers, HostSurfaceMembers, HostSettingsMembers } from "./roots.ts";

export type HostEntry = {
  readonly identity: () => Result<HostIdentity, unknown>;
  readonly tokens: HostBuildMembers["tokens"];
  readonly commands: HostBuildMembers["commands"];
  readonly fills: HostBuildMembers["fills"];
  readonly bindingHeading: string;
  readonly distribution: HostBuildMembers["distribution"];
  readonly renderData: HostSurfaceMembers["renderData"];
  readonly placements: HostSurfaceMembers["placements"];
  readonly agents: { readonly inputs: readonly string[]; readonly render: HostAgentMembers["render"] };
  readonly skills: { readonly inputs: readonly string[]; readonly render: HostSkillMembers["render"] };
  readonly settings: { readonly inputs: readonly string[]; readonly render: HostSettingsMembers["render"] };
  readonly documents: { readonly inputs: HostDocumentMembers["inputs"]; readonly render: HostDocumentMembers["render"] };
};

const HOST_ENTRIES: readonly HostEntry[] = [
  { identity: claudeHostIdentity, tokens: CLAUDE_TOKENS, commands: claudeCommandPath,
    fills: CLAUDE_ONBOARDING_FILLS, bindingHeading: CLAUDE_BINDING_HEADING, distribution: claudeDistribution,
    renderData: () => CLAUDE_HOST_DATA, placements: CLAUDE_AUTHORED_PLACEMENTS,
    agents: { inputs: [], render: claudeAgents },
    skills: { inputs: CLAUDE_SKILL_INPUTS, render: createClaudeSkillRenderer },
    settings: { inputs: CLAUDE_SETTINGS_INPUTS, render: createClaudeSettingsRenderer },
    documents: { inputs: [], render: createClaudeDocumentRenderer } },
  { identity: kiroHostIdentity, tokens: KIRO_TOKENS, commands: kiroCommandPath,
    fills: KIRO_ONBOARDING_FILLS, bindingHeading: KIRO_BINDING_HEADING, distribution: kiroDistribution,
    renderData: () => KIRO_HOST_DATA, placements: KIRO_AUTHORED_PLACEMENTS,
    agents: { inputs: KIRO_AGENT_JSON, render: kiroAgents },
    skills: { inputs: KIRO_SKILL_INPUTS, render: createKiroSkillRenderer },
    settings: { inputs: KIRO_SETTINGS_INPUTS, render: createKiroSettingsRenderer },
    documents: { inputs: [], render: createKiroDocumentRenderer } },
  { identity: kiroIdeHostIdentity, tokens: KIRO_IDE_TOKENS, commands: kiroIdeCommandPath,
    fills: KIRO_IDE_ONBOARDING_FILLS, bindingHeading: KIRO_IDE_BINDING_HEADING,
    distribution: kiroIdeDistribution, renderData: kiroIdeHostData, placements: KIRO_IDE_AUTHORED_PLACEMENTS,
    agents: { inputs: ["agents/aidlc-aidlc.md"],
      render: createKiroIdeAgents({ personas: kiroAgentRenderer }) },
    skills: { inputs: KIRO_IDE_SKILL_INPUTS, render: createKiroIdeSkillRenderer },
    settings: { inputs: KIRO_IDE_SETTINGS_INPUTS, render: createKiroIdeSettingsRenderer },
    documents: { inputs: [], render: createKiroIdeDocumentRenderer } },
  { identity: codexHostIdentity, tokens: CODEX_TOKENS, commands: codexCommandPath,
    fills: CODEX_ONBOARDING_FILLS, bindingHeading: CODEX_BINDING_HEADING, distribution: codexDistribution,
    renderData: () => CODEX_HOST_DATA, placements: CODEX_AUTHORED_PLACEMENTS,
    agents: { inputs: [], render: codexAgents },
    skills: { inputs: CODEX_SKILL_INPUTS, render: createCodexSkillRenderer },
    settings: { inputs: CODEX_SETTINGS_INPUTS, render: createCodexSettingsRenderer },
    documents: { inputs: [], render: createCodexDocumentRenderer } },
  { identity: cursorHostIdentity, tokens: CURSOR_TOKENS, commands: cursorCommandPath,
    fills: CURSOR_ONBOARDING_FILLS, bindingHeading: CURSOR_BINDING_HEADING, distribution: cursorDistribution,
    renderData: () => CURSOR_HOST_DATA, placements: CURSOR_AUTHORED_PLACEMENTS,
    agents: { inputs: [], render: cursorAgents },
    skills: { inputs: CURSOR_SKILL_INPUTS, render: createCursorSkillRenderer },
    settings: { inputs: CURSOR_SETTINGS_INPUTS, render: createCursorSettingsRenderer },
    documents: { inputs: [], render: createCursorDocumentRenderer } },
  { identity: openCodeHostIdentity, tokens: OPENCODE_TOKENS, commands: openCodeCommandPath,
    fills: OPENCODE_ONBOARDING_FILLS, bindingHeading: OPENCODE_BINDING_HEADING, distribution: openCodeDistribution,
    renderData: () => OPENCODE_HOST_DATA, placements: OPENCODE_AUTHORED_PLACEMENTS,
    agents: { inputs: [], render: openCodeAgents },
    skills: { inputs: OPENCODE_SKILL_INPUTS, render: createOpenCodeSkillRenderer },
    settings: { inputs: OPENCODE_SETTINGS_INPUTS, render: createOpenCodeSettingsRenderer },
    documents: { inputs: [], render: createOpenCodeDocumentRenderer } },
  { identity: copilotHostIdentity, tokens: COPILOT_TOKENS, commands: copilotCommandPath,
    fills: COPILOT_ONBOARDING_FILLS, bindingHeading: COPILOT_BINDING_HEADING, distribution: copilotDistribution,
    renderData: () => COPILOT_HOST_DATA, placements: COPILOT_AUTHORED_PLACEMENTS,
    agents: { inputs: [], render: copilotAgents },
    skills: { inputs: COPILOT_SKILL_INPUTS, render: createCopilotSkillRenderer },
    settings: { inputs: COPILOT_SETTINGS_INPUTS, render: createCopilotSettingsRenderer },
    documents: { inputs: [], render: createCopilotDocumentRenderer } },
];

type RegisteredHost = { readonly host: HostIdentity; readonly entry: HostEntry };

const REGISTERED_HOSTS: readonly RegisteredHost[] = HOST_ENTRIES.flatMap((entry) => {
  const identity = entry.identity();
  return identity.ok ? [{ host: identity.value, entry }] : [];
});

const entryNamed = (name: string): HostEntry | undefined =>
  REGISTERED_HOSTS.find((registered) => registered.host.distribution === name)?.entry;

const sourcePaths = (inputs: readonly string[]) => {
  const paths = inputs.map(sourcePath);
  const failed = paths.find((path) => !path.ok);
  return failed && !failed.ok ? refused(failed.refusal)
    : accepted(paths.flatMap((path) => path.ok ? [path.value] : []));
};

export const hostAgentInputs = (name: string): readonly string[] => entryNamed(name)?.agents.inputs ?? [];

export const hostAgentMembers = (host: HostIdentity):
Result<HostAgentMembers | null, ProjectionRefusal> => {
  const entry = entryNamed(host.distribution);
  if (!entry) return accepted(null);
  const paths = sourcePaths(entry.agents.inputs);
  if (!paths.ok) return refused({ kind: "render-failed", concept: "agent",
    name: host.distribution, reason: `The authored agent input is invalid: ${paths.refusal.raw}` });
  return accepted({ host, render: entry.agents.render, inputs: paths.value });
};

export const hostSkillInputs = (name: string): readonly string[] => entryNamed(name)?.skills.inputs ?? [];

export const hostSkillMembers = (host: HostIdentity): Result<HostSkillMembers | null, ProjectionRefusal> => {
  const entry = entryNamed(host.distribution);
  if (!entry) return accepted(null);
  const paths = sourcePaths(entry.skills.inputs);
  if (!paths.ok) return refused({ kind: "render-failed", concept: "orchestrator-skill",
    name: paths.refusal.raw, reason: "The authored skill input is not a portable source path." });
  return accepted({ host, inputs: paths.value, render: entry.skills.render });
};

export const hostSurfaceMembers = (host: HostIdentity): HostSurfaceMembers | null => {
  const entry = entryNamed(host.distribution);
  return entry ? { host, renderData: entry.renderData, placements: entry.placements } : null;
};

export const hostSettingsInputs = (name: string): readonly string[] => entryNamed(name)?.settings.inputs ?? [];

export const hostSettingsMembers = (host: HostIdentity): Result<HostSettingsMembers | null, ProjectionRefusal> => {
  const entry = entryNamed(host.distribution);
  if (!entry) return accepted(null);
  const paths = sourcePaths(entry.settings.inputs);
  if (!paths.ok) return refused({ kind: "render-failed", concept: "settings",
    name: paths.refusal.raw, reason: "The authored settings input is not a portable source path." });
  return accepted({ host, inputs: paths.value, render: entry.settings.render });
};

export const hostBindingHeadings = (): readonly string[] =>
  REGISTERED_HOSTS.map((registered) => registered.entry.bindingHeading);

export const BINDING_HEADINGS: Readonly<Record<string, string>> = Object.fromEntries(
  REGISTERED_HOSTS.map((registered) => [registered.host.distribution, registered.entry.bindingHeading]),
);

export const hostDocumentMembers = (host: HostIdentity): HostDocumentMembers | null => {
  const entry = entryNamed(host.distribution);
  return entry ? { host, inputs: entry.documents.inputs, render: entry.documents.render } : null;
};

export type HostBuildRefusal = {
  readonly kind: "host-build-refused";
  readonly member: "identity" | "agents" | "skills" | "settings" | "documents" | "surface";
  readonly host: string | null;
  readonly reason: unknown;
};

const refusedMember = ({ member, host, reason }: {
  readonly member: HostBuildRefusal["member"]; readonly host: HostIdentity | null; readonly reason: unknown;
}): HostBuildRefusal => ({ kind: "host-build-refused", member, host: host?.distribution ?? null, reason });

export const hostBuildMembers = (entry: HostEntry): Result<HostBuildMembers, HostBuildRefusal> => {
  const identity = entry.identity();
  if (!identity.ok) return refused(refusedMember({ member: "identity", host: null, reason: identity.refusal }));
  const host = identity.value;
  const agentInputs = sourcePaths(entry.agents.inputs);
  if (!agentInputs.ok) return refused(refusedMember({ member: "agents", host, reason: agentInputs.refusal }));
  const skillInputs = sourcePaths(entry.skills.inputs);
  if (!skillInputs.ok) return refused(refusedMember({ member: "skills", host, reason: skillInputs.refusal }));
  const settingInputs = sourcePaths(entry.settings.inputs);
  if (!settingInputs.ok) return refused(refusedMember({ member: "settings", host, reason: settingInputs.refusal }));
  return accepted({ host, tokens: entry.tokens, renderData: entry.renderData, placements: entry.placements,
    agents: { host, render: entry.agents.render, inputs: agentInputs.value },
    skills: { host, render: entry.skills.render, inputs: skillInputs.value },
    settings: { host, render: entry.settings.render, inputs: settingInputs.value },
    documents: { host, inputs: entry.documents.inputs, render: entry.documents.render },
    commands: entry.commands, fills: entry.fills, bindingHeading: entry.bindingHeading,
    distribution: entry.distribution });
};

const BUILT = HOST_ENTRIES.map(hostBuildMembers);

export const HOST_BUILD_MEMBERS: HostBuildTable = BUILT.flatMap((built) => built.ok ? [built.value] : []);

export const HOST_BUILD_REFUSALS: readonly HostBuildRefusal[] = BUILT.flatMap((built) => built.ok ? [] : [built.refusal]);
