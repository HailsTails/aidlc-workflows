import { expect, test } from "bun:test";
import { integrationStage, metricsAgent } from "../../__tests__/agent-fixtures.ts";
import { compiledCatalogue, compiledArtifact, pluginStageBasis } from "../../__tests__/compiled-stage-fixtures.ts";
import { agentParticipation } from "./stage-participation.ts";
test("one stage can supply both lead and reviewer participation without losing either", () => {
  expect(agentParticipation({ agent: metricsAgent, stages: [{ ...integrationStage, lead: metricsAgent.name, supports: [], reviewer: metricsAgent.name }] })).toEqual([{ origin: integrationStage.origin, stage: integrationStage.slug, mode: "inline", role: "lead" }, { origin: integrationStage.origin, stage: integrationStage.slug, mode: "inline", role: "reviewer" }]);
});
test("compiled pipeline support keeps both topology and contribution provenance", () => {
  expect(agentParticipation({ agent: metricsAgent, stages: compiledCatalogue.stages })).toEqual([{ origin: { kind: "compiled", artifact: compiledArtifact, definition: pluginStageBasis }, stage: "test-pro-integration", mode: "pipeline", role: "support" }]);
});
test("a reviewer-like name without a source link does not invent participation", () => {
  expect(agentParticipation({ agent: { ...metricsAgent, name: "unlinked-reviewer-agent" }, stages: compiledCatalogue.stages })).toEqual([]);
});
test("keeps stage support and core lead distinct", () => {
  expect(agentParticipation({ agent: metricsAgent, stages: [integrationStage] })).toEqual([{ origin: integrationStage.origin, stage: "test-pro-integration", mode: "inline", role: "support" }]);
  expect(agentParticipation({ agent: { ...metricsAgent, name: "aidlc-quality-agent" }, stages: [integrationStage] })).toEqual([{ origin: integrationStage.origin, stage: "test-pro-integration", mode: "inline", role: "lead" }]);
  expect(agentParticipation({ agent: { ...metricsAgent, name: "unrelated-agent" }, stages: [integrationStage] })).toEqual([]);
});
