import { expect, mock, test } from "bun:test";
import { createCoreGuidanceSourceReader } from "./core-guidance-sources.ts";
import { createGuidanceOperations, guidanceBasis, guidanceSources } from "../../__tests__/core-guidance-fixtures.ts";
test("admits conductor and protocols once with admitted UTF-8 text digests", async () => {
  const operations = createGuidanceOperations();
  expect(await createCoreGuidanceSourceReader({ operations }).load({ sourceRoot: "source", basis: guidanceBasis })).toEqual({ status: "ok", value: guidanceSources });
  expect(operations.conductor).toHaveBeenCalledWith({ sourceRoot: "source" });
  expect(operations.protocols).toHaveBeenCalledWith({ sourceRoot: "source" });
  expect(operations.digest).toHaveBeenNthCalledWith(1, { bytes: new Uint8Array([67, 114, 97, 102, 116, 10]) });
  expect(operations.digest).toHaveBeenNthCalledWith(2, { bytes: new Uint8Array([71, 117, 105, 100, 101, 10]) });
});
test.each([
  [[]],
  [[{ path: "core/aidlc-common/protocols/../private.md", text: "Text" }]],
  [[{ path: "core/aidlc-common/stages/inception/requirements.md", text: "Stage" }]],
  [[{ path: "core/aidlc-common/protocols/runtime.ts", text: "Runtime" }]],
  [[{ path: "core/aidlc-common/protocols/stage-protocol.md", text: " " }]],
])("does not silently discard unsupported protocol inventory", async (protocols) => {
  expect(await createCoreGuidanceSourceReader({ operations: { ...createGuidanceOperations(), protocols: mock().mockResolvedValue(protocols) } }).load({ sourceRoot: "source", basis: guidanceBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-guidance-sources", detail: "guidance requires the nonempty authored conductor and core/aidlc-common/protocols/<slug>.md inventory; unsupported assets were not dropped" }] });
});
test.each([[""], [null]])("requires the actual conductor instead of fabricating one", async (conductor) => {
  expect(await createCoreGuidanceSourceReader({ operations: { ...createGuidanceOperations(), conductor: mock().mockResolvedValue(conductor) } }).load({ sourceRoot: "source", basis: guidanceBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-guidance-sources", detail: "guidance requires the nonempty authored conductor and core/aidlc-common/protocols/<slug>.md inventory; unsupported assets were not dropped" }] });
});
test("duplicate protocols cannot acquire competing destinations", async () => {
  expect(await createCoreGuidanceSourceReader({ operations: { ...createGuidanceOperations(), protocols: mock().mockResolvedValue([{ path: "core/aidlc-common/protocols/stage-protocol.md", text: "One" }, { path: "core/aidlc-common/protocols/stage-protocol.md", text: "Two" }]) } }).load({ sourceRoot: "source", basis: guidanceBasis })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core-guidance-sources", detail: "authored protocol paths must be unique" }] });
});
test("unavailable source remains a specific capability failure", async () => {
  expect(await createCoreGuidanceSourceReader({ operations: { ...createGuidanceOperations(), conductor: mock().mockRejectedValue(new Error("private input")) } }).load({ sourceRoot: "source", basis: guidanceBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-guidance-sources", detail: "authored guidance inputs unavailable; inspect conductor, protocol inventory and source reader" }] });
});
test("plugin provenance is refused before either source operation", async () => {
  const operations = createGuidanceOperations();
  expect(await createCoreGuidanceSourceReader({ operations }).load({ sourceRoot: "source", basis: { source: { kind: "plugin", id: "rin" }, pin: "guidance-pin" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-guidance-sources", detail: "declare the authored framework source basis before reading conductor and protocols" }] });
  expect(operations.conductor).not.toHaveBeenCalled();
  expect(operations.protocols).not.toHaveBeenCalled();
});
