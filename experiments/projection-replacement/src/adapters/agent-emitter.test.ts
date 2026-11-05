import { expect, test } from "bun:test";
import { kasMetricsInput, kiroMetricsInput } from "../../__tests__/agent-native-fixtures.ts";
import { createAgentEmitter } from "./agent-emitter.ts";

test("composition: the Kiro v1/v2 default requires its JSON policy", () => {
  expect(createAgentEmitter({ harness: "kiro" }).emit(kiroMetricsInput)).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "Kiro agent-v1/v2 requires an authored native JSON profile and prepared grants",
      },
    ],
  });
});
test("composition: the KAS default requires its distinct worker policy", () => {
  expect(createAgentEmitter({ harness: "kiro-ide" }).emit(kasMetricsInput)).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "KAS native worker permissions must be prepared from the selected harness policy",
      },
    ],
  });
});
