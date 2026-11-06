import { expect, mock, test } from "bun:test";
import { createCoreKnowledgeSourceReader } from "./core-knowledge-sources.ts";
import { coreKnowledgeBasis, coreKnowledgeSources, coreKnowledgeSourceOperations, coreKnowledgeText } from "../../__tests__/core-knowledge-fixtures.ts";
test("retains raw authored metadata and source content witnesses for the projection owner", async () => {
  expect(await createCoreKnowledgeSourceReader({ operations: coreKnowledgeSourceOperations() }).load({ sourceRoot: "source", basis: coreKnowledgeBasis })).toEqual({ status: "ok", value: coreKnowledgeSources });
});
test.each([
  [[{ path: "core/knowledge/aidlc-shared/helper.ts", text: "runtime" }]],
  [[{ path: "core/knowledge/../aidlc-shared/guide.md", text: "unsafe" }]],
  [[{ path: "plugins/other/knowledge/aidlc-shared/guide.md", text: "foreign" }]],
  [[{ path: "core/knowledge/aidlc-shared/guide.md", text: " " }]],
  [[]],
])("refuses unsupported inventories without dropping entries", async (inventory) => {
  expect(await createCoreKnowledgeSourceReader({ operations: { ...coreKnowledgeSourceOperations(), inventory: mock().mockResolvedValue(inventory) } }).load({ sourceRoot: "source", basis: coreKnowledgeBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-knowledge-sources", detail: "authored core knowledge require a nonempty inventory of core/knowledge/<group>/<name>.md; companion assets and unsupported entries were not dropped" }] });
});
test("duplicate authored paths cannot produce two competing knowledge owners", async () => {
  expect(await createCoreKnowledgeSourceReader({ operations: { ...coreKnowledgeSourceOperations(), inventory: mock().mockResolvedValue([{ path: "core/knowledge/aidlc-shared/guide.md", text: coreKnowledgeText }, { path: "core/knowledge/aidlc-shared/guide.md", text: "other" }]) } }).load({ sourceRoot: "source", basis: coreKnowledgeBasis })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core-knowledge-sources", detail: "authored knowledge paths must be unique" }] });
});
test("source unavailability is distinct from authored content refusal", async () => {
  expect(await createCoreKnowledgeSourceReader({ operations: { ...coreKnowledgeSourceOperations(), inventory: mock().mockRejectedValue(new Error("private source")) } }).load({ sourceRoot: "source", basis: coreKnowledgeBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-knowledge-sources", detail: "authored core knowledge inputs unavailable; inspect the source inventory and content reader" }] });
});
test("a plugin basis cannot acquire ownership of core source paths", async () => {
  expect(await createCoreKnowledgeSourceReader({ operations: coreKnowledgeSourceOperations() }).load({ sourceRoot: "source", basis: { ...coreKnowledgeBasis, source: { kind: "plugin", id: "other" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-knowledge-sources", detail: "declare the authored framework source basis before reading core knowledge" }] });
});
