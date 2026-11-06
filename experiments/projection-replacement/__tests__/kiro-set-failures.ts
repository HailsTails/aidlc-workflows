import type { KiroAgentSetEntry } from "../examples/kiro-agent-set.ts";
import { preparedMetrics } from "./agent-fixtures.ts";
import { preparedKiroProfile, kiroMetricsInput } from "./agent-native-fixtures.ts";

export const setEntry: KiroAgentSetEntry = {
  prepared: { ...preparedMetrics, context: { ...preparedMetrics.context, harness: "kiro", directory: ".kiro" }, nativeModel: kiroMetricsInput.nativeModel },
  profile: preparedKiroProfile,
  promptAdditions: [],
  resolvedSelection: { model: "claude-sonnet-4.6", effort: "high" },
};
export const duplicateSetFindings = [
  { code: "destination-collision", subject: ".kiro/agents/test-pro-metrics-agent.md", detail: "native file set must emit each destination once" },
  { code: "destination-collision", subject: ".kiro/agents/test-pro-metrics-agent.json", detail: "native file set must emit each destination once" },
  { code: "destination-collision", subject: ".kiro/knowledge/test-pro-metrics-agent/methodology.md", detail: "native file set must emit each destination once" },
] as const;
