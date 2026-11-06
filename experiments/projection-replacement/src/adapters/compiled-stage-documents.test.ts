import { expect, test } from "bun:test";
import { parseStageDocumentRequirements } from "./compiled-stage-documents.ts";
import { stageDependencySeed, stageGraphFile } from "../../__tests__/stage-fixtures.ts";
import { distributionSeed } from "../../__tests__/distribution-fixtures.ts";
test("declared initialization stages remain runtime dependencies alongside runnable stages", () => {
  expect(parseStageDocumentRequirements({ seed: stageDependencySeed })).toEqual({ status: "ok", value: [".claude/aidlc-common/stages/initialization/workspace-scaffold.md", ".claude/aidlc-common/stages/construction/code-generation.md"] });
});
test("missing compiled declarations cannot become an empty dependency set", () => {
  expect(parseStageDocumentRequirements({ seed: distributionSeed })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/tools/data/stage-graph.json", detail: "stage document dependencies require the runtime's compiled graph" }] });
});
test("malformed JSON stays a decoding failure", () => {
  expect(parseStageDocumentRequirements({ seed: { ...distributionSeed, files: [...distributionSeed.files, { ...stageGraphFile, bytes: new Uint8Array([123]) }] } })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: ".claude/tools/data/stage-graph.json", detail: "stage document dependencies require valid compiled graph JSON" }] });
});
test("unsafe or unsupported declared phases cannot escape the engine's stage layout", () => {
  expect(parseStageDocumentRequirements({ seed: { ...distributionSeed, files: [...distributionSeed.files, { ...stageGraphFile, bytes: new TextEncoder().encode('[{"slug":"code-generation","phase":"../outside"}]') }] } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/tools/data/stage-graph.json", detail: "stage document dependencies require canonical native phase/slug declarations; unsupported rows were not dropped" }] });
});
test("duplicate slugs cannot bypass dependencies by moving one declaration to another phase", () => {
  expect(parseStageDocumentRequirements({ seed: { ...distributionSeed, files: [...distributionSeed.files, { ...stageGraphFile, bytes: new TextEncoder().encode('[{"slug":"code-generation","phase":"construction"},{"slug":"code-generation","phase":"operation"}]') }] } })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: ".claude/tools/data/stage-graph.json", detail: "compiled stage dependency slugs must be globally unique" }] });
});
test("selection-disabled declarations remain preserved document dependencies", () => {
  expect(parseStageDocumentRequirements({ seed: { ...distributionSeed, files: [...distributionSeed.files, { ...stageGraphFile, bytes: new TextEncoder().encode('[{"slug":"code-generation","phase":"construction","enabled":false}]') }] } })).toEqual({ status: "ok", value: [".claude/aidlc-common/stages/construction/code-generation.md"] });
});
