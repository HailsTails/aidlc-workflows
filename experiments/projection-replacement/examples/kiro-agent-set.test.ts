import { expect, test } from "bun:test";
import { kiroSetCases } from "../__tests__/kiro-set-cases.ts";
import { successful } from "../__tests__/support.ts";
import { parseAgentSource } from "../src/adapters/agent-source.ts";
import { createAgentPreparation } from "../src/domain/agent-preparation.ts";
import { parseKiroAgentProfile, prepareKiroAgentProfile, kiroCopyCommandPatterns } from "../src/adapters/kiro-agent.ts";
import { parseKiroCliSettings } from "../src/adapters/kiro-cli-settings.ts";
import { projectKiroAgentSet } from "./kiro-agent-set.ts";
import { setEntry, duplicateSetFindings } from "../__tests__/kiro-set-failures.ts";
import { plainSettings } from "../__tests__/kiro-settings-fixtures.ts";

test("composition: duplicate agents refuse instead of emitting repeated settings or native files", () => {
  expect(projectKiroAgentSet({ settings: plainSettings, agents: [setEntry, setEntry] })).toEqual({ status: "invalid", findings: duplicateSetFindings });
});
test("composition: a foreign native profile refuses the complete set without partial output", () => {
  expect(projectKiroAgentSet({ settings: plainSettings, agents: [{ ...setEntry, profile: { ...setEntry.profile, origin: { ...setEntry.profile.origin, pin: "other" } } }] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "test-pro-metrics-agent", detail: "Kiro native profile must reference this persona and source pin" }] });
});
test("composition: inherited session models cannot acquire guessed effort defaults", () => {
  expect(projectKiroAgentSet({ settings: plainSettings, agents: [{ ...setEntry, resolvedSelection: { model: null, effort: "high" } }] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: "Kiro effort requires an explicit model and one of low, medium, high, xhigh or max; inherited session effort cannot be projected here" }] });
});

test.each(kiroSetCases)("composition: $baseline Kiro agent set matches pinned model-policy surfaces: $label", (entry) => {
  const settings = successful(parseKiroCliSettings({ text: entry.settingsText, origin: entry.settingsOrigin }));
  const first = successful(createAgentPreparation().prepare({ agent: successful(parseAgentSource(entry.sources[0].source)), context: entry.base.context, knowledge: entry.sources[0].source.knowledge, stages: [] }));
  const second = successful(createAgentPreparation().prepare({ agent: successful(parseAgentSource(entry.sources[1].source)), context: entry.base.context, knowledge: entry.sources[1].source.knowledge, stages: [] }));
  const shellCommands = kiroCopyCommandPatterns({ dispatcherCommands: entry.base.dispatcherCommands, toolScripts: entry.base.toolScripts, dialect: entry.base.commandDialect });
  const firstProfile = successful(prepareKiroAgentProfile({ profile: successful(parseKiroAgentProfile({ text: entry.sources[0].profileText, origin: entry.sources[0].profileOrigin })), shellCommands, sharedResources: entry.base.sharedResources, invocation: entry.base.context.invocation, hookSuffix: entry.base.hookSuffix }));
  const secondProfile = successful(prepareKiroAgentProfile({ profile: successful(parseKiroAgentProfile({ text: entry.sources[1].profileText, origin: entry.sources[1].profileOrigin })), shellCommands, sharedResources: entry.base.sharedResources, invocation: entry.base.context.invocation, hookSuffix: entry.base.hookSuffix }));
  const projected = successful(projectKiroAgentSet({ settings, agents: [
    { prepared: first, profile: firstProfile, promptAdditions: entry.base.promptAdditions, resolvedSelection: entry.selections[0] },
    { prepared: second, profile: secondProfile, promptAdditions: entry.base.promptAdditions, resolvedSelection: entry.selections[1] },
  ] }));
  expect(projected.resources).toEqual(entry.expectedResources);
  expect(projected.modelPlan.resolutions).toEqual(entry.expectedResolutions);
});
