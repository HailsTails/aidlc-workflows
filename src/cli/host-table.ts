import { KIRO_SKILL_INPUTS, createKiroSkillRenderer } from "../hosts/kiro/projection/skill-renderer.ts";
import { CODEX_SKILL_INPUTS, createCodexSkillRenderer } from "../hosts/codex/projection/skill-renderer.ts";
import { createClaudeSkillRenderer } from "../hosts/claude/projection/skill-renderer.ts";
import { CLAUDE_SKILL_INPUTS } from "../hosts/claude/projection/skill-renderer.ts";
import type { HostIdentity } from "../kernel/host.ts";
import { accepted, refused, type Result } from "../kernel/result.ts";
import { sourcePath } from "../kernel/values.ts";
import { KIRO_AGENT_JSON, kiroAgents } from "../hosts/kiro/projection/json-agent-renderer.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";
import type { HostAgentMembers, HostSkillMembers } from "./roots.ts";

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