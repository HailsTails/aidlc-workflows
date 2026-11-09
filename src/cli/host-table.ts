import { KIRO_IDE_AUTHORED_PLACEMENTS } from "../hosts/kiro-ide/host-data.ts";
import { kiroIdeHostData } from "../hosts/kiro-ide/projection/host-data-renderer.ts";
import { COPILOT_HOST_DATA, COPILOT_AUTHORED_PLACEMENTS } from "../hosts/copilot/host-data.ts";
import { CURSOR_HOST_DATA, CURSOR_AUTHORED_PLACEMENTS } from "../hosts/cursor/host-data.ts";
import { CLAUDE_SETTINGS_INPUTS, createClaudeSettingsRenderer } from "../hosts/claude/projection/settings-renderer.ts";
import { OPENCODE_HOST_DATA, OPENCODE_AUTHORED_PLACEMENTS } from "../hosts/opencode/host-data.ts";
import { KIRO_HOST_DATA, KIRO_AUTHORED_PLACEMENTS } from "../hosts/kiro/host-data.ts";
import { CODEX_HOST_DATA, CODEX_AUTHORED_PLACEMENTS } from "../hosts/codex/host-data.ts";
import { COPILOT_SKILL_INPUTS, createCopilotSkillRenderer } from "../hosts/copilot/projection/skill-renderer.ts";
import { CURSOR_SKILL_INPUTS, createCursorSkillRenderer } from "../hosts/cursor/projection/skill-renderer.ts";
import { KIRO_IDE_SKILL_INPUTS, createKiroIdeSkillRenderer } from "../hosts/kiro-ide/projection/skill-renderer.ts";
import { CLAUDE_HOST_DATA, CLAUDE_AUTHORED_PLACEMENTS } from "../hosts/claude/host-data.ts";
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

const AGENT_MEMBERS = [{ name: "kiro", inputs: KIRO_AGENT_JSON, render: kiroAgents }] as const;

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
