import type { HostIdentity } from "../kernel/host.ts";
import { accepted, refused, type Result } from "../kernel/result.ts";
import { sourcePath } from "../kernel/values.ts";
import { KIRO_AGENT_JSON, kiroAgents } from "../hosts/kiro/projection/json-agent-renderer.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";
import type { HostAgentMembers } from "./roots.ts";

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