import { expect, mock, test } from "bun:test";
import { discoverNativeRunnerRequirements, nativeProducerRequiredPaths } from "../../../../../scripts/projection/src/application/native-runner-requirements.ts";
import { absentScopeSeed, changedRequirementInputs, createRequirementRules, discoveredRunners, emptyScopeSeed, extraScopeInputs, nativeRequirements, nestedScopeSeed, omittedScopeInputs, requirementSeed } from "../../support/__tests__/runner-requirement-fixtures.ts";
import { runnerFailure } from "../../support/__tests__/runner-fixtures.ts";
import { generatedRequirementFacts, generatedRequirements } from "../../support/__tests__/runner-requirement-fixtures.ts";
test("producer reconciliation protects observed scope and metadata dependencies without calling them runners", () => {
  expect(nativeProducerRequiredPaths({ requirements: nativeRequirements })).toEqual([".claude/skills/aidlc-code-generation/SKILL.md", ".claude/tools/data/harness.json", ".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json", ".claude/scopes/bugfix.md"]);
});
test("a runner-only fact set does not invent scope files or directory requirements", () => {
  expect(nativeProducerRequiredPaths({ requirements: { ...nativeRequirements, inputs: [] } })).toEqual([".claude/skills/aidlc-code-generation/SKILL.md"]);
});
test("generator coverage binds init and compose paths without changing the native layout", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: generatedRequirementFacts }) }, rules: createRequirementRules() })).toEqual({ status: "ok", value: generatedRequirements });
});
test("binds native requirements to the input snapshot's actual input bytes", () => {
  const rules = createRequirementRules();
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: discoveredRunners }) }, rules })).toEqual({ status: "ok", value: nativeRequirements });
  expect(rules.path).toHaveBeenCalledWith({ path: ".claude/skills/aidlc-code-generation/SKILL.md" });
});
test("unavailable discovery cannot produce empty trusted requirements", () => {
  const rules = createRequirementRules();
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue(runnerFailure) }, rules })).toEqual(runnerFailure);
  expect(rules.path).not.toHaveBeenCalled();
});
test("the same compiler pin cannot authorize a different selection snapshot", () => {
  const rules = createRequirementRules();
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, inputs: changedRequirementInputs } }) }, rules })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "native-runner-inputs", detail: "native runner inputs differ from the input snapshot; reload requirements and their input snapshot together before reconciling" }] });
  expect(rules.path).not.toHaveBeenCalled();
});
test.each([{ label: "omitted scope", inputs: omittedScopeInputs }, { label: "extra scope", inputs: extraScopeInputs }])("refuses $label input witnesses", ({ inputs }) => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, inputs } }) }, rules: createRequirementRules() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "native-runner-inputs", detail: "native runner inputs differ from the input snapshot; reload requirements and their input snapshot together before reconciling" }] });
});
test("nested scope notes ignored by the native producer do not create false mismatches", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: nestedScopeSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: discoveredRunners }) }, rules: createRequirementRules() })).toEqual({ status: "ok", value: nativeRequirements });
});
test("foreign harness facts refuse before trusting entrypoints", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, binding: { harness: "cursor", directory: ".cursor" } } }) }, rules: createRequirementRules() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/tools/aidlc-runner-gen.ts", detail: "native requirements must come from the input snapshot's harness and compiler source basis" }] });
});
test("unsafe native paths refuse before publishing requirement facts", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: discoveredRunners }) }, rules: { ...createRequirementRules(), path: mock().mockReturnValue("unsafe") } })).toEqual({ status: "invalid", findings: [{ code: "invalid-destination", subject: ".claude/skills/aidlc-code-generation/SKILL.md", detail: "native runner requirements must name safe relative entrypoints" }] });
});
test("duplicate native destinations cannot be hidden by set deduplication", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, runners: [...discoveredRunners.runners, ...discoveredRunners.runners] } }) }, rules: createRequirementRules() })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: "native-runner-requirements", detail: "different native definitions cannot claim one runner entrypoint" }] });
});
test("a validated empty catalogue is allowed without implicit deletions", () => {
  const rules = createRequirementRules();
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, runners: [] } }) }, rules })).toEqual({ status: "ok", value: { ...nativeRequirements, paths: [], runners: [] } });
  expect(rules.path).not.toHaveBeenCalled();
});
test("native layout changes are observed without assuming an emitter path", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, skillRoot: ".claude/legacy-skills" } }) }, rules: createRequirementRules() })).toEqual({ status: "ok", value: { ...nativeRequirements, skillRoot: ".claude/legacy-skills", paths: [".claude/legacy-skills/aidlc-code-generation/SKILL.md"] } });
});
test("matching input bytes cannot bridge a foreign compiler source pin", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: requirementSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, compiler: { ...discoveredRunners.compiler, pin: "other" } } }) }, rules: createRequirementRules() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/tools/aidlc-runner-gen.ts", detail: "native requirements must come from the input snapshot's harness and compiler source basis" }] });
});
test("an empty scope directory remains distinct from an absent input directory", () => {
  expect(discoverNativeRunnerRequirements({ inputSnapshot: emptyScopeSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, inputs: omittedScopeInputs, runners: [] } }) }, rules: createRequirementRules() })).toEqual({ status: "ok", value: { ...nativeRequirements, inputs: omittedScopeInputs, paths: [], runners: [] } });
  expect(discoverNativeRunnerRequirements({ inputSnapshot: absentScopeSeed, discovery: { discover: mock().mockReturnValue({ status: "ok", value: { ...discoveredRunners, inputs: omittedScopeInputs, runners: [] } }) }, rules: createRequirementRules() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "native-runner-inputs", detail: "native runner inputs differ from the input snapshot; reload requirements and their input snapshot together before reconciling" }] });
});
