import type { PreparedAgent, AgentProjection, AgentOrigin } from "../src/domain/agent-definition.ts";
import { prepareKiroModelDefaults, type KiroModelPlan } from "../src/domain/kiro-model-defaults.ts";
import type { NativeTier, Outcome } from "../src/domain/model.ts";
import { collectNativeFiles } from "../src/domain/native-file-set.ts";
import type { NativeResource } from "../src/domain/native-rendering.ts";
import { createAgentRenderer } from "../src/domain/agent-rendering.ts";
import { createKiroAgentEmitter, type PreparedKiroAgentProfile } from "../src/adapters/kiro-agent.ts";
import { renderKiroCliSettings, type KiroCliSettings } from "../src/adapters/kiro-cli-settings.ts";

export type KiroAgentSetEntry = {
  readonly prepared: PreparedAgent;
  readonly profile: PreparedKiroAgentProfile;
  readonly promptAdditions: readonly string[];
  readonly resolvedSelection: NativeTier;
};
export type KiroAgentSetProjection = {
  readonly settingsOrigin: AgentOrigin;
  readonly agents: readonly AgentProjection[];
  readonly modelPlan: KiroModelPlan;
  readonly resources: readonly NativeResource[];
};
const projectSetEntry = ({ entry }: { readonly entry: KiroAgentSetEntry }): Outcome<AgentProjection> =>
  createAgentRenderer({ emitter: createKiroAgentEmitter({ profile: entry.profile, promptAdditions: entry.promptAdditions, modelOverride: entry.resolvedSelection.model }) }).render(entry.prepared);
type CollectedKiroAgents = { readonly agents: readonly AgentProjection[]; readonly resources: readonly NativeResource[] };
const collectSetResources = ({ projected, cli }: { readonly projected: readonly Outcome<AgentProjection>[]; readonly cli: NativeResource }): Outcome<CollectedKiroAgents> => {
  const findings = projected.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (findings.length > 0) return { status: "invalid", findings };
  const agents = projected.flatMap((entry) => entry.status === "ok" ? [entry.value] : []);
  const resources = [...agents.flatMap((entry) => entry.resources), cli];
  const collected = collectNativeFiles({ resources });
  if (collected.status === "invalid") return collected;
  return { status: "ok", value: { agents, resources: collected.value } };
};
export const projectKiroAgentSet = ({ settings, agents }: {
  readonly settings: KiroCliSettings;
  readonly agents: readonly KiroAgentSetEntry[];
}): Outcome<KiroAgentSetProjection> => {
  const requests = agents.map((entry) => ({ origin: entry.prepared.agent.origin, agent: entry.prepared.agent.name, ...entry.resolvedSelection }));
  const modelPlan = prepareKiroModelDefaults({ origin: settings.origin, current: settings.current, requests });
  if (modelPlan.status === "invalid") return modelPlan;
  const cli = renderKiroCliSettings({ settings, plan: modelPlan.value });
  if (cli.status === "invalid") return cli;
  const projected = agents.map((entry) => projectSetEntry({ entry }));
  const collected = collectSetResources({ projected, cli: cli.value });
  if (collected.status === "invalid") return collected;
  return { status: "ok", value: { settingsOrigin: settings.origin, ...collected.value, modelPlan: modelPlan.value } };
};
