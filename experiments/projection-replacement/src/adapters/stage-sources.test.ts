import { expect, test, mock } from "bun:test";
import { createStageSourceReader, createStageSourceOperations } from "./stage-sources.ts";
import { createStageSourceFixture, stageSources, stageText } from "../../__tests__/stage-fixtures.ts";
import { distributionBasis } from "../../__tests__/distribution-fixtures.ts";
test("composition: authored stage inventory keeps source identities and exact content witnesses", async () => {
  expect(await createStageSourceReader({ operations: createStageSourceFixture() }).load({ sourceRoot: "source", basis: distributionBasis })).toEqual({ status: "ok", value: stageSources });
});
test("composition: equal slugs in different phases cannot hide behind unique paths", async () => {
  expect(await createStageSourceReader({ operations: { ...createStageSourceFixture(), inventory: mock().mockResolvedValue([{ path: "core/aidlc-common/stages/construction/code-generation.md", text: stageText }, { path: "core/aidlc-common/stages/operation/code-generation.md", text: stageText }]) } }).load({ sourceRoot: "source", basis: distributionBasis })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "stage-sources", detail: "authored stage slugs must be unique across phase directories" }] });
});
test("unsupported authored entries are refused rather than copied as runtime material", async () => {
  expect(await createStageSourceReader({ operations: { ...createStageSourceFixture(), inventory: mock().mockResolvedValue([{ path: "core/aidlc-common/stages/engine.ts", text: "runtime" }]) } }).load({ sourceRoot: "source", basis: distributionBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "stage-sources", detail: "core stage projection requires nonempty native phase/slug Markdown inventory; unsupported entries were not dropped" }] });
});
test("unavailable authored inventory returns a capability failure", async () => {
  expect(await createStageSourceReader({ operations: { ...createStageSourceFixture(), inventory: mock().mockRejectedValue(new Error("unreadable")) } }).load({ sourceRoot: "source", basis: distributionBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "stage-sources", detail: "authored stage inputs unavailable: unreadable" }] });
});
test("production factory composes shared inventory and content digest ports", () => {
  expect(createStageSourceOperations()).toMatchObject({ inventory: expect.any(Function), digest: expect.any(Function) });
});
