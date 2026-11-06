import { expect, mock, test } from "bun:test";
import { createCoreSkillSourceReader } from "./core-skill-sources.ts";
import { coreSkillBasis, coreSkillSources, coreSkillSourceOperations, coreSkillText } from "../../__tests__/core-skill-fixtures.ts";
test("retains raw authored metadata and source content witnesses for the projection owner", async () => {
  expect(await createCoreSkillSourceReader({ operations: coreSkillSourceOperations() }).load({ sourceRoot: "source", basis: coreSkillBasis })).toEqual({ status: "ok", value: coreSkillSources });
});
test.each([
  [[{ path: "core/skills/aidlc-note/helper.ts", text: "runtime" }]],
  [[{ path: "core/skills/../aidlc-note/SKILL.md", text: "unsafe" }]],
  [[{ path: "plugins/other/skills/aidlc-note/SKILL.md", text: "foreign" }]],
  [[]],
])("refuses unsupported inventories without dropping entries", async (inventory) => {
  expect(await createCoreSkillSourceReader({ operations: { ...coreSkillSourceOperations(), inventory: mock().mockResolvedValue(inventory) } }).load({ sourceRoot: "source", basis: coreSkillBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-skill-sources", detail: "authored core skills require a nonempty inventory of core/skills/<name>/SKILL.md; companion assets and unsupported entries were not dropped" }] });
});
test("duplicate authored paths cannot produce two competing skill owners", async () => {
  expect(await createCoreSkillSourceReader({ operations: { ...coreSkillSourceOperations(), inventory: mock().mockResolvedValue([{ path: "core/skills/aidlc-note/SKILL.md", text: coreSkillText }, { path: "core/skills/aidlc-note/SKILL.md", text: "other" }]) } }).load({ sourceRoot: "source", basis: coreSkillBasis })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core-skill-sources", detail: "authored skill paths must be unique" }] });
});
test("source unavailability is distinct from authored content refusal", async () => {
  expect(await createCoreSkillSourceReader({ operations: { ...coreSkillSourceOperations(), inventory: mock().mockRejectedValue(new Error("private source")) } }).load({ sourceRoot: "source", basis: coreSkillBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-skill-sources", detail: "authored core skill inputs unavailable; inspect the source inventory and content reader" }] });
});
test("a plugin basis cannot acquire ownership of core source paths", async () => {
  expect(await createCoreSkillSourceReader({ operations: coreSkillSourceOperations() }).load({ sourceRoot: "source", basis: { ...coreSkillBasis, source: { kind: "plugin", id: "other" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-skill-sources", detail: "declare the authored framework source basis before reading core skills" }] });
});
