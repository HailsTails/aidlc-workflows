import { expect, mock, test } from "bun:test";
import { createGuidanceBindingPreparer } from "./guidance-bindings.ts";
import { createGuidanceBindingOperations, createGuidanceSelector, guidanceHeadingsExport, guidanceBindingRequest, guidanceContext, preparedConductor, preparedProtocol, preparedGuidance, createGuidanceProse } from "../../__tests__/core-guidance-fixtures.ts";
test("prepares every document through the admitted source-owned selector with its witness", async () => {
  const selector = createGuidanceSelector(), operations = createGuidanceBindingOperations({ selector }), prose = createGuidanceProse();
  expect(await createGuidanceBindingPreparer({ operations, prose }).prepare(guidanceBindingRequest)).toEqual({ status: "ok", value: preparedGuidance });
  expect(operations.bytes).toHaveBeenCalledWith({ sourceRoot: "source" });
  expect(operations.bytes).toHaveBeenCalledTimes(2);
  expect(operations.load).toHaveBeenCalledWith({ sourceRoot: "source", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });
  expect(operations.digest).toHaveBeenCalledWith({ bytes: new Uint8Array([99]) });
  expect(prose).toHaveBeenNthCalledWith(1, { markdown: "Craft\n", context: guidanceContext, subject: "core/aidlc-common/conductor.md" });
  expect(prose).toHaveBeenNthCalledWith(2, { markdown: "Guide\n", context: guidanceContext, subject: "core/aidlc-common/protocols/stage-protocol.md" });
  expect(selector.keepOwnHarnessBindings).toHaveBeenCalledTimes(1);
  expect(selector.keepOwnHarnessBindings).toHaveBeenCalledWith("Prose guide\n", "claude", "core/aidlc-common/protocols/stage-protocol.md");
});
test.each([[{}], [{ ...createGuidanceSelector(), keepOwnHarnessBindings: undefined }]])("missing source capabilities remain explicit", async (selector) => {
  expect(await createGuidanceBindingPreparer({ operations: createGuidanceBindingOperations({ selector }), prose: createGuidanceProse() }).prepare(guidanceBindingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/harness-bindings.ts", detail: "source-owned guidance selector must export harness headings and keepOwnHarnessBindings for the selected harness" }] });
});
test("a selector without the requested harness cannot retain all other bindings", async () => {
  const selector = { ...createGuidanceSelector(), [guidanceHeadingsExport]: { codex: "Codex CLI" } };
  expect(await createGuidanceBindingPreparer({ operations: createGuidanceBindingOperations({ selector }), prose: createGuidanceProse() }).prepare(guidanceBindingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/harness-bindings.ts", detail: "source-owned guidance selector must export harness headings and keepOwnHarnessBindings for the selected harness" }] });
  expect(selector.keepOwnHarnessBindings).not.toHaveBeenCalled();
});
test("one non-text selector result prevents a successful partial preparation", async () => {
  const selector = { ...createGuidanceSelector(), keepOwnHarnessBindings: mock().mockReturnValue(7) };
  expect(await createGuidanceBindingPreparer({ operations: createGuidanceBindingOperations({ selector }), prose: createGuidanceProse() }).prepare(guidanceBindingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/harness-bindings.ts", detail: "source-owned guidance selector must return text for each admitted document" }] });
});
test("unavailable selector bytes are not an authored-content violation", async () => {
  const operations = { ...createGuidanceBindingOperations(), bytes: mock().mockRejectedValue(new Error("private source path")) };
  expect(await createGuidanceBindingPreparer({ operations, prose: createGuidanceProse() }).prepare(guidanceBindingRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "scripts/harness-bindings.ts", detail: "source-owned guidance binding selector unavailable; inspect the selected source checkout and API" }] });
  expect(operations.load).not.toHaveBeenCalled();
});
test("changed selector bytes cannot acquire stable source provenance", async () => {
  const operations = { ...createGuidanceBindingOperations(), digest: mock().mockReturnValueOnce("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb").mockReturnValueOnce("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc") };
  expect(await createGuidanceBindingPreparer({ operations, prose: createGuidanceProse() }).prepare(guidanceBindingRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "scripts/harness-bindings.ts", detail: "guidance binding selector changed during preparation; retry from stable source" }] });
});
test("conductor headings are retained while only protocols use the binding selector", async () => {
  const selector = createGuidanceSelector(), prose = mock().mockReturnValueOnce({ status: "ok", value: "### Claude Code\nConductor note\n" }).mockReturnValueOnce({ status: "ok", value: "Prose guide\n" });
  expect(await createGuidanceBindingPreparer({ operations: createGuidanceBindingOperations({ selector }), prose }).prepare(guidanceBindingRequest)).toEqual({ status: "ok", value: { documents: [{ ...preparedConductor, text: "### Claude Code\nConductor note\n" }, preparedProtocol], inputs: preparedGuidance.inputs } });
  expect(selector.keepOwnHarnessBindings).toHaveBeenCalledTimes(1);
  expect(selector.keepOwnHarnessBindings).toHaveBeenCalledWith("Prose guide\n", "claude", "core/aidlc-common/protocols/stage-protocol.md");
});
test("prose failure is retained without a partial prepared collection", async () => {
  const prose = mock().mockReturnValueOnce({ status: "invalid", findings: [{ code: "unresolved-token", subject: "core/aidlc-common/conductor.md", detail: "{{OPTION_LETTERS}} at line 1" }] }).mockReturnValueOnce({ status: "ok", value: "Prose guide\n" });
  expect(await createGuidanceBindingPreparer({ operations: createGuidanceBindingOperations(), prose }).prepare(guidanceBindingRequest)).toEqual({ status: "invalid", findings: [{ code: "unresolved-token", subject: "core/aidlc-common/conductor.md", detail: "{{OPTION_LETTERS}} at line 1" }] });
  expect(prose).toHaveBeenNthCalledWith(1, { markdown: "Craft\n", context: guidanceContext, subject: "core/aidlc-common/conductor.md" });
  expect(prose).toHaveBeenNthCalledWith(2, { markdown: "Guide\n", context: guidanceContext, subject: "core/aidlc-common/protocols/stage-protocol.md" });
});
test("unsupported native-release delivery is refused before source I/O", async () => {
  const operations = createGuidanceBindingOperations(), prose = createGuidanceProse();
  expect(await createGuidanceBindingPreparer({ operations, prose }).prepare({ ...guidanceBindingRequest, context: { ...guidanceContext, invocation: "aidlc" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-guidance-bindings", detail: "guidance text qualifies Bun copy delivery; native-release command preparation requires a source-owned capability" }] });
  expect(operations.bytes).not.toHaveBeenCalled();
  expect(operations.load).not.toHaveBeenCalled();
  expect(prose).not.toHaveBeenCalled();
});
test("foreign authored pins cannot bypass binding preparation admission", async () => {
  const operations = createGuidanceBindingOperations(), prose = createGuidanceProse();
  expect(await createGuidanceBindingPreparer({ operations, prose }).prepare({ ...guidanceBindingRequest, basis: { ...guidanceBindingRequest.basis, pin: "other" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-guidance-bindings", detail: "bind authored guidance from one declared framework source basis" }] });
  expect(operations.bytes).not.toHaveBeenCalled();
  expect(prose).not.toHaveBeenCalled();
});
