import { expect, mock, test } from "bun:test";
import {
  claudeAgentContext,
  integrationStage,
  methodologyKnowledge,
  metricsAgent,
  preparedMetrics,
} from "../../../../tests/unit/projection/support/__tests__/agent-fixtures.ts";
import { createAgentPreparation } from "./agent-preparation.ts";

test("unsupported authored policy stops before knowledge, model and stage work", () => {
  const refusal = { status: "invalid", findings: [{ code: "capability-gap", subject: metricsAgent.name, detail: "host policy unavailable" }] } as const;
  const persona = mock().mockReturnValue(metricsAgent.body);
  const policy = mock().mockReturnValue(refusal);
  const knowledge = mock();
  const participation = mock();
  const model = mock();
  expect(createAgentPreparation({ rules: { persona, policy, knowledge, participation, model } }).prepare({ agent: metricsAgent, context: claudeAgentContext, knowledge: [], stages: [] })).toEqual(refusal);
  expect(knowledge).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
  expect(participation).not.toHaveBeenCalled();
});

test("agent preparation wires policy, knowledge and stage facts", () => {
  const persona = mock().mockReturnValue(metricsAgent.body);
  const policy = mock().mockReturnValue({ status: "ok", value: metricsAgent.policy });
  const knowledge = mock().mockReturnValue({ status: "ok", value: [methodologyKnowledge] });
  const participation = mock().mockReturnValue(preparedMetrics.participation);
  const model = mock().mockReturnValue({ model: "sonnet", effort: null });
  const input = {
    agent: metricsAgent,
    context: claudeAgentContext,
    knowledge: [methodologyKnowledge],
    stages: [integrationStage],
  };
  const prepared = createAgentPreparation({ rules: { persona, policy, knowledge, participation, model } }).prepare(
    input,
  );
  expect(prepared).toEqual({ status: "ok", value: preparedMetrics });
  expect(persona).toHaveBeenCalledWith({agent:metricsAgent,knowledge:[methodologyKnowledge],participation:preparedMetrics.participation});
  expect(policy).toHaveBeenCalledWith(input);
  expect(knowledge).toHaveBeenCalledWith(input);
  expect(participation).toHaveBeenCalledWith(input);
  expect(model).toHaveBeenCalledWith({ choice: metricsAgent.model, context: claudeAgentContext });
});
test("agent preparation refuses an empty invocation before delegates", () => {
  const persona = mock().mockReturnValue(metricsAgent.body);
  const policy = mock().mockReturnValue({ status: "ok", value: metricsAgent.policy });
  const knowledge = mock();
  const participation = mock();
  const model = mock();
  const prepared = createAgentPreparation({ rules: { persona, policy, knowledge, participation, model } }).prepare({
    agent: metricsAgent,
    context: { ...claudeAgentContext, invocation: " " },
    knowledge: [],
    stages: [],
  });
  expect(prepared).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-invocation",
        subject: "test-pro-metrics-agent",
        detail: "agent projection requires an invocation",
      },
    ],
  });
  expect(knowledge).not.toHaveBeenCalled();
  expect(participation).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
});
test("agent preparation stops atomically on missing knowledge", () => {
  const refusal = {
    status: "invalid",
    findings: [
      { code: "missing-knowledge", subject: "methodology.md", detail: "source file unavailable" },
    ],
  } as const;
  const persona = mock().mockReturnValue(metricsAgent.body);
  const policy = mock().mockReturnValue({ status: "ok", value: metricsAgent.policy });
  const knowledge = mock().mockReturnValue(refusal);
  const participation = mock();
  const model = mock();
  const input = { agent: metricsAgent, context: claudeAgentContext, knowledge: [], stages: [] };
  const prepared = createAgentPreparation({ rules: { persona, policy, knowledge, participation, model } }).prepare(
    input,
  );
  expect(prepared).toEqual(refusal);
  expect(knowledge).toHaveBeenCalledWith(input);
  expect(participation).not.toHaveBeenCalled();
  expect(model).not.toHaveBeenCalled();
});
