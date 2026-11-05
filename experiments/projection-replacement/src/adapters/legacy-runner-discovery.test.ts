import { expect, mock, test } from "bun:test";
import { createLegacyRunnerDiscovery } from "./legacy-runner-discovery.ts";
import { createDiscoveryFixture, discoveredRunners, discoveryFactoryInput, nativeRequirementReply, pluginRequirementMarkdown, pluginRequirementRunner, requirementDirectoryInputs, requirementInputs, requirementRunner } from "../../__tests__/runner-requirement-fixtures.ts";
import { runnerFailure } from "../../__tests__/runner-fixtures.ts";
import { createGeneratedDiscoveryFixture, generatedRequirementFacts, generatedRequirementReply, incompleteGeneratedReplies, nativeShortcutEntries, pluginShortcutReply } from "../../__tests__/runner-requirement-fixtures.ts";
test("discovers all native rows through the existing parser port", () => {
  const fixture = createDiscoveryFixture();
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...fixture }).discover()).toEqual({ status: "ok", value: discoveredRunners });
  expect(fixture.process.execute).toHaveBeenCalledWith({ runtime: discoveryFactoryInput.runtime, requests: [], intent: "discover" });
  expect(fixture.rules.parse).toHaveBeenCalledWith({ markdown: "source stage", compiler: discoveryFactoryInput.compiler, owner: { kind: "core", id: "framework" }, binding: { harness: "claude", directory: ".claude" }, request: { kind: "stage", slug: "code-generation" } });
});
test("a valid empty native catalogue stays distinct from unavailability", () => {
  const fixture = createDiscoveryFixture();
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...fixture, process: { execute: mock().mockReturnValue({ status: "ok", value: { status: "ok", scope: "native-stage-and-scope-runners", skillRoot: ".claude/skills", entries: [], inputs: requirementInputs, directoryInputs: requirementDirectoryInputs } }) } }).discover()).toEqual({ status: "ok", value: { ...discoveredRunners, runners: [] } });
  expect(fixture.rules.parse).not.toHaveBeenCalled();
});
test("native process unavailability never becomes an empty successful catalogue", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...createDiscoveryFixture(), process: { execute: mock().mockReturnValue(runnerFailure) } }).discover()).toEqual(runnerFailure);
});
test("explicit producer unavailability retains guidance", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...createDiscoveryFixture(), process: { execute: mock().mockReturnValue({ status: "ok", value: { status: "unavailable", detail: "compiled stage graph is unavailable" } }) } }).discover()).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "claude", detail: "compiled stage graph is unavailable" }] });
});
test("missing input witnesses refuse even if entries are empty", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...createDiscoveryFixture(), process: { execute: mock().mockReturnValue({ status: "ok", value: { status: "ok", skillRoot: ".claude/skills", entries: [], inputs: [] } }) } }).discover()).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/tools/aidlc-runner-gen.ts", detail: "native runner discovery must return scoped definitions and input digests, or an unavailability finding" }] });
});
test("duplicate native identities refuse before parsing product text", () => {
  const fixture = createDiscoveryFixture();
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...fixture, process: { execute: mock().mockReturnValue({ status: "ok", value: { ...nativeRequirementReply, entries: [...nativeRequirementReply.entries, ...nativeRequirementReply.entries] } }) } }).discover()).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core/tools/aidlc-runner-gen.ts", detail: "native discovery must report each runner identity and input path once" }] });
  expect(fixture.rules.parse).not.toHaveBeenCalled();
});
test("metadata refusals invalidate the entire requirement catalogue", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...createDiscoveryFixture(), rules: { key: mock().mockReturnValue("stage:code-generation"), parse: mock().mockReturnValue(runnerFailure) } }).discover()).toEqual(runnerFailure);
});
test("plugin ownership is supplied by the producer independently of compiler ownership", () => {
  const fixture = createDiscoveryFixture();
  const parse = mock().mockReturnValue({ status: "ok", value: pluginRequirementRunner });
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...fixture, rules: { ...fixture.rules, parse }, process: { execute: mock().mockReturnValue({ status: "ok", value: { ...nativeRequirementReply, entries: [{ request: { kind: "stage", slug: "rin-gate-0-reconcile" }, owner: { kind: "plugin", id: "rin" }, markdown: "source plugin" }] } }) } }).discover()).toEqual({ status: "ok", value: { ...discoveredRunners, runners: [pluginRequirementRunner] } });
  expect(parse).toHaveBeenCalledWith({ markdown: "source plugin", compiler: discoveryFactoryInput.compiler, owner: { kind: "plugin", id: "rin" }, binding: { harness: "claude", directory: ".claude" }, request: { kind: "stage", slug: "rin-gate-0-reconcile" } });
});
test("composition: the real metadata reader preserves the native plugin owner and emitted name", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, process: { execute: mock().mockReturnValue({ status: "ok", value: { ...nativeRequirementReply, entries: [{ request: { kind: "stage", slug: "rin-gate-0-reconcile" }, owner: { kind: "plugin", id: "rin" }, markdown: pluginRequirementMarkdown }] } }) } }).discover()).toEqual({ status: "ok", value: { ...discoveredRunners, runners: [pluginRequirementRunner] } });
});
test("init cannot silently enter a catalogue scoped to native stage and scope checks", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...createDiscoveryFixture(), process: { execute: mock().mockReturnValue({ status: "ok", value: { ...nativeRequirementReply, entries: [{ request: { kind: "init" }, owner: requirementRunner.owner, markdown: "source" }] } }) } }).discover()).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core/tools/aidlc-runner-gen.ts", detail: "generated-runner coverage requires core init and compose shortcuts; a stage/scope-only catalogue must not claim them" }] });
});
test("complete generator coverage includes both shortcuts without requiring stages", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...createGeneratedDiscoveryFixture() }).discover()).toEqual({ status: "ok", value: generatedRequirementFacts });
});
test.each(incompleteGeneratedReplies)("complete coverage cannot omit $label", ({ reply }) => {
  const fixture = createGeneratedDiscoveryFixture();
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...fixture, process: { execute: mock().mockReturnValue({ status: "ok", value: reply }) } }).discover()).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core/tools/aidlc-runner-gen.ts", detail: "generated-runner coverage requires core init and compose shortcuts; a stage/scope-only catalogue must not claim them" }] });
  expect(fixture.rules.parse).not.toHaveBeenCalled();
});
test("duplicate shortcuts cannot satisfy coverage by overwriting one identity", () => {
  const fixture = createGeneratedDiscoveryFixture();
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...fixture, process: { execute: mock().mockReturnValue({ status: "ok", value: { ...generatedRequirementReply, entries: [...nativeShortcutEntries, ...nativeShortcutEntries] } }) } }).discover()).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core/tools/aidlc-runner-gen.ts", detail: "native discovery must report each runner identity and input path once" }] });
  expect(fixture.rules.parse).not.toHaveBeenCalled();
});
test("a plugin cannot claim the generator's fixed core shortcuts", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, ...createGeneratedDiscoveryFixture(), process: { execute: mock().mockReturnValue({ status: "ok", value: pluginShortcutReply }) } }).discover()).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core/tools/aidlc-runner-gen.ts", detail: "generated-runner coverage requires core init and compose shortcuts; a stage/scope-only catalogue must not claim them" }] });
});
test("composition: real frontmatter parsing retains init and compose definitions", () => {
  expect(createLegacyRunnerDiscovery({ ...discoveryFactoryInput, process: { execute: mock().mockReturnValue({ status: "ok", value: generatedRequirementReply }) } }).discover()).toEqual({ status: "ok", value: generatedRequirementFacts });
});
