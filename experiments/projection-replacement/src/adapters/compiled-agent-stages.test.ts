import { expect, test } from "bun:test";
import { compiledArtifact, compiledBinding, compiledSources, compiledStageText, compiledCatalogue, disabledStageText, duplicateStageText, aliasedStageText, missingNativeLeadText, futureModeText, coreStageBasis, pluginStageBasis } from "../../__tests__/compiled-stage-fixtures.ts";
import { parseCompiledAgentStages } from "./compiled-agent-stages.ts";
test("compiled participation preserves topology, native fields and separate contribution provenance", () => {
  expect(parseCompiledAgentStages({ text: compiledStageText, artifact: compiledArtifact, binding: compiledBinding, sources: compiledSources })).toEqual({ status: "ok", value: compiledCatalogue });
});
test("unrelated native graph fields and internal-looking aliases cannot override native roster keys", () => {
  expect(parseCompiledAgentStages({ text: aliasedStageText, artifact: compiledArtifact, binding: compiledBinding, sources: compiledSources })).toEqual({ status: "ok", value: compiledCatalogue });
});
test("disabled native definitions retain reviewer participation for static persona preparation", () => {
  expect(parseCompiledAgentStages({ text: disabledStageText, artifact: compiledArtifact, binding: compiledBinding, sources: compiledSources })).toEqual({ status: "ok", value: compiledCatalogue });
});
test("disabled rows cannot conceal duplicate stage identities", () => {
  expect(parseCompiledAgentStages({ text: duplicateStageText, artifact: compiledArtifact, binding: compiledBinding, sources: compiledSources })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "test-pro-integration", detail: "compiled stage slugs must be unique, including disabled rows" }] });
});
test("duplicate owner declarations refuse rather than choosing one pin", () => {
  expect(parseCompiledAgentStages({ text: compiledStageText, artifact: compiledArtifact, binding: compiledBinding, sources: [coreStageBasis, pluginStageBasis, { ...pluginStageBasis, pin: "another-pin" }] })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "plugin:test-pro", detail: "compiled stage source bases must identify each owner once" }] });
});
test("compiler provenance cannot fill in a missing definition pin", () => {
  expect(parseCompiledAgentStages({ text: compiledStageText, artifact: compiledArtifact, binding: compiledBinding, sources: [coreStageBasis] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-integration", detail: "compiled stage owner plugin:test-pro requires an explicit source pin; the artifact pin does not establish definition provenance" }] });
});
test("reserved topology is an explicit gap rather than a fabricated subagent mode", () => {
  expect(parseCompiledAgentStages({ text: futureModeText, artifact: compiledArtifact, binding: compiledBinding, sources: compiledSources })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-integration", detail: "compiled stage mode agent-team is unsupported for participation; preserve the source topology" }] });
});
test("native field absence is not repaired from a camel-case alias", () => {
  expect(parseCompiledAgentStages({ text: missingNativeLeadText, artifact: compiledArtifact, binding: compiledBinding, sources: compiledSources })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: ".claude/tools/data/stage-graph.json", detail: "compiled participation requires native slug, mode, lead_agent, support_agents and valid optional plugin/reviewer/enabled fields, with explicit owner source bases" }] });
});
test("invalid JSON returns a boundary finding", () => {
  expect(parseCompiledAgentStages({ text: "{", artifact: compiledArtifact, binding: compiledBinding, sources: compiledSources })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: ".claude/tools/data/stage-graph.json", detail: "expected compiled stage graph JSON" }] });
});
test("a graph from another native directory refuses", () => {
  expect(parseCompiledAgentStages({ text: compiledStageText, artifact: compiledArtifact, binding: { harness: "codex", directory: ".codex" }, sources: compiledSources })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/tools/data/stage-graph.json", detail: "compiled participation requires the selected harness's framework stage-graph artifact" }] });
});
