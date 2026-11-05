import type { AgentOrigin } from "./agent-definition.ts";
import { finding, type Outcome } from "./model.ts";

export type KiroEffort = "low" | "medium" | "high" | "xhigh" | "max";
export type KiroModelRequest = {
  readonly origin: AgentOrigin;
  readonly agent: string;
  readonly model: string | null;
  readonly effort: string | null;
};
export type KiroModelContribution = { readonly agent: string; readonly model: string; readonly effort: KiroEffort };
export type KiroModelPlan = {
  readonly origin: AgentOrigin;
  readonly baseline: Readonly<Record<string, KiroEffort | null>>;
  readonly updates: Readonly<Record<string, KiroEffort>>;
  readonly resolutions: readonly { readonly agent: string; readonly model: string; readonly requested: KiroEffort; readonly applied: KiroEffort }[];
};
const efforts: readonly KiroEffort[] = ["low", "medium", "high", "xhigh", "max"];
const contribution = ({ request, origin }: { readonly request: KiroModelRequest; readonly origin: AgentOrigin }): Outcome<KiroModelContribution | null> => {
  if (request.origin.pin !== origin.pin)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: request.agent, detail: "Kiro model requests and CLI settings must share a source pin" })] };
  if (request.model !== null && !/^[a-zA-Z0-9][a-zA-Z0-9/._:-]*$/.test(request.model))
    return { status: "invalid", findings: [finding({ code: "invalid-input", subject: request.agent, detail: "Kiro model selection requires a nonempty native model identifier" })] };
  if (request.effort === null) return { status: "ok", value: null };
  const effort = efforts.find((candidate) => candidate === request.effort);
  if (request.model === null || effort === undefined)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: request.agent, detail: "Kiro effort requires an explicit model and one of low, medium, high, xhigh or max; inherited session effort cannot be projected here" })] };
  return { status: "ok", value: { agent: request.agent, model: request.model, effort } };
};
export const prepareKiroModelDefaults = ({ origin, current, requests }: {
  readonly origin: AgentOrigin;
  readonly current: Readonly<Record<string, KiroEffort | null>>;
  readonly requests: readonly KiroModelRequest[];
}): Outcome<KiroModelPlan> => {
  const prepared = requests.map((request) => contribution({ request, origin }));
  const findings = prepared.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (findings.length > 0) return { status: "invalid", findings };
  const contributions = prepared.flatMap((entry) => entry.status === "ok" && entry.value !== null ? [entry.value] : []);
  const updates = contributions.reduce<Readonly<Record<string, KiroEffort>>>((merged, entry) => {
    const existing = merged[entry.model] ?? current[entry.model] ?? "low";
    return { ...merged, [entry.model]: efforts.indexOf(existing) > efforts.indexOf(entry.effort) ? existing : entry.effort };
  }, {});
  const resolutions = contributions.map((entry) => ({ agent: entry.agent, model: entry.model, requested: entry.effort, applied: updates[entry.model] ?? entry.effort }));
  return { status: "ok", value: { origin, baseline: current, updates, resolutions } };
};
