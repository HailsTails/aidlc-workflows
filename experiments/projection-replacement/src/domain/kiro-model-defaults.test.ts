import { expect, test } from "bun:test";
import { settingsOrigin, highRequest, highPlan, emptyPlan } from "../../__tests__/kiro-settings-fixtures.ts";
import { prepareKiroModelDefaults } from "./kiro-model-defaults.ts";

test("one resolved model effort becomes a shared model-default contribution", () => {
  expect(prepareKiroModelDefaults({ origin: settingsOrigin, current: {}, requests: [highRequest] })).toEqual({ status: "ok", value: highPlan });
});
test("no effort request leaves the defaults map absent", () => {
  expect(prepareKiroModelDefaults({ origin: settingsOrigin, current: {}, requests: [{ ...highRequest, model: null, effort: null }] })).toEqual({ status: "ok", value: emptyPlan });
});
test("agents sharing a model use its highest requested effort and expose the collapse", () => {
  expect(prepareKiroModelDefaults({ origin: settingsOrigin, current: {}, requests: [{ ...highRequest, agent: "first-agent", effort: "medium" }, highRequest] })).toEqual({ status: "ok", value: { ...highPlan, resolutions: [{ agent: "first-agent", model: "claude-sonnet-4.6", requested: "medium", applied: "high" }, { agent: "aidlc-quality-agent", model: "claude-sonnet-4.6", requested: "high", applied: "high" }] } });
});
test("an existing higher effort stays higher and unrelated models do not become updates", () => {
  expect(prepareKiroModelDefaults({ origin: settingsOrigin, current: { "claude-sonnet-4.6": "max", "claude-haiku-4.5": "low" }, requests: [highRequest] })).toEqual({ status: "ok", value: { ...highPlan, baseline: { "claude-sonnet-4.6": "max", "claude-haiku-4.5": "low" }, updates: { "claude-sonnet-4.6": "max" }, resolutions: [{ agent: "aidlc-quality-agent", model: "claude-sonnet-4.6", requested: "high", applied: "max" }] } });
});
test.each([{ ...highRequest, model: null }, { ...highRequest, effort: "turbo" }])("unsupported effort demands fail rather than guessing session behavior", (request) => {
  expect(prepareKiroModelDefaults({ origin: settingsOrigin, current: {}, requests: [request] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "aidlc-quality-agent", detail: "Kiro effort requires an explicit model and one of low, medium, high, xhigh or max; inherited session effort cannot be projected here" }] });
});
test("foreign source requests fail before emitting a shared plan", () => {
  expect(prepareKiroModelDefaults({ origin: settingsOrigin, current: {}, requests: [{ ...highRequest, origin: { ...settingsOrigin, pin: "other" } }] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "aidlc-quality-agent", detail: "Kiro model requests and CLI settings must share a source pin" }] });
});
test("empty model ids cannot create anonymous settings entries", () => {
  expect(prepareKiroModelDefaults({ origin: settingsOrigin, current: {}, requests: [{ ...highRequest, model: "" }] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "aidlc-quality-agent", detail: "Kiro model selection requires a nonempty native model identifier" }] });
});
