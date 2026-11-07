import { expect, test } from "bun:test";
import { compiledCatalogue, coreStageBasis } from "../../support/__tests__/compiled-stage-fixtures.ts";
import { metricsAgent } from "../../support/__tests__/agent-fixtures.ts";
import { bindAgentStageCatalogue } from "../../../../../scripts/projection/src/domain/compiled-agent-stages.ts";
test("agent binding uses its owner's pin independently of the compiler artifact pin", () => {
  expect(bindAgentStageCatalogue({ agent: { ...metricsAgent, origin: { ...metricsAgent.origin, pin: "plugin-definition-pin" } }, catalogue: compiledCatalogue })).toEqual({ status: "ok", value: compiledCatalogue.stages });
});
test("a core actor may participate in a plugin stage from another source revision", () => {
  expect(bindAgentStageCatalogue({ agent: { ...metricsAgent, origin: { source: { kind: "core", id: "framework" }, pin: "core-definition-pin", path: "core/agents/test-pro-metrics-agent.md" } }, catalogue: compiledCatalogue })).toEqual({ status: "ok", value: compiledCatalogue.stages });
});
test("a stage catalogue does not invent an absent actor source basis", () => {
  expect(bindAgentStageCatalogue({ agent: metricsAgent, catalogue: { ...compiledCatalogue, sources: [coreStageBasis] } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: "compiled stage catalogue must establish this agent owner's source pin before participation is used" }] });
});
test("an actor at another pin refuses even if its name and owner match", () => {
  expect(bindAgentStageCatalogue({ agent: metricsAgent, catalogue: compiledCatalogue })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "test-pro-metrics-agent", detail: "agent source pin differs from its source basis in the compiled stage catalogue" }] });
});
