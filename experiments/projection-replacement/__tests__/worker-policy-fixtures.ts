import { metricsAgent } from "./agent-fixtures.ts";
import { authoredKiroProfile } from "./agent-native-fixtures.ts";
import type { WorkerAdmissions, WorkerAdmissionBinding } from "../src/domain/worker-policy.ts";
import type { AuthoredKiroAgentProfile, SpecializedKiroAgentProfile } from "../src/adapters/kiro-agent.ts";

export const admissionOrigin = { ...authoredKiroProfile.origin, path: "core/hooks/aidlc-state-transition-guard.ts" };
export const templateAdmissions: WorkerAdmissions = { origin: admissionOrigin, name: "aidlc-quality-agent", verbs: { "aidlc-state.ts": ["get", "lookup"] } };
export const targetAdmissions: WorkerAdmissions = { ...templateAdmissions, name: metricsAgent.name };
export const workerTemplate: AuthoredKiroAgentProfile = {
  ...authoredKiroProfile, name: "aidlc-quality-agent", prompt: "file://aidlc-quality-agent.md",
  resources: ["file://.kiro/agents/aidlc-quality-agent.md", "file://.kiro/knowledge/aidlc-quality-agent/*.md", "file://.kiro/knowledge/aidlc-shared/*.md"],
  hooks: { preToolUse: [{ matcher: "execute_bash", command: "{{INVOKE}} engine adapter kiro state-transition-guard aidlc-quality-agent", timeoutMs: 100 }] },
};
export const workerBinding: WorkerAdmissionBinding = { template: { origin: workerTemplate.origin, name: workerTemplate.name }, target: metricsAgent, authority: admissionOrigin };
export const specializedKiro: SpecializedKiroAgentProfile = {
  targetBasis: { kind: "native-source" },
  targetOrigin: { ...workerTemplate.origin, path: "declared-extension/metrics-worker.json" },
  ...workerTemplate, state: "specialized", binding: workerBinding, name: metricsAgent.name, description: metricsAgent.description, prompt: "file://test-pro-metrics-agent.md",
  resources: ["file://.kiro/agents/test-pro-metrics-agent.md", "file://.kiro/knowledge/test-pro-metrics-agent/*.md", "file://.kiro/knowledge/aidlc-shared/*.md"],
  hooks: { preToolUse: [{ matcher: "execute_bash", command: "{{INVOKE}} engine adapter kiro state-transition-guard test-pro-metrics-agent", timeoutMs: 100 }] },
};
export const incompatibleAdmissionCases = [
  { label: "different target pin", target: { ...targetAdmissions, origin: { ...admissionOrigin, pin: "other" } } },
  { label: "another target actor", target: { ...targetAdmissions, name: "another-agent" } },
  { label: "another authority path", target: { ...targetAdmissions, origin: { ...admissionOrigin, path: "other.ts" } } },
  { label: "another authority owner", target: { ...targetAdmissions, origin: { ...admissionOrigin, source: { kind: "plugin", id: "other" } as const } } },
];
export const roleAdmissionCases = [
  { label: "extra role verb", verbs: { "aidlc-state.ts": ["get", "lookup", "set"] } },
  { label: "missing read", verbs: { "aidlc-state.ts": ["get"] } },
  { label: "different tool", verbs: { "aidlc-worktree.ts": ["get", "lookup"] } },
];

export const declaredMetricsProfile: AuthoredKiroAgentProfile = { ...specializedKiro, state: "authored", origin: specializedKiro.targetOrigin };
export const kiroBehaviorDifferenceCases = [
  { field: "tools", profile: { ...declaredMetricsProfile, tools: ["fs_read"] } },
  { field: "allowedTools", profile: { ...declaredMetricsProfile, allowedTools: ["execute_bash"] } },
  { field: "shellCommands", profile: { ...declaredMetricsProfile, shellCommands: ["unrelated command"] } },
  { field: "shellDenials", profile: { ...declaredMetricsProfile, shellDenials: null } },
  { field: "writePaths", profile: { ...declaredMetricsProfile, writePaths: ["one/proposal.json"] } },
  { field: "resources", profile: { ...declaredMetricsProfile, resources: ["file://.kiro/scopes/*.md"] } },
  { field: "hooks", profile: { ...declaredMetricsProfile, hooks: {} } },
];
