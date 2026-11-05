import { expect, test } from "bun:test";
import { createNativeStageCommandPreparer } from "./native-stage-commands.ts";
import { createNativeStageOperations, nativeStageRequest, nativeStageCommands, nativeStageReply, nativeStageDocument, nativeStageExpectedEnvironment, nativeStageForbiddenEnvironment, dispatcherStageReply } from "../../__tests__/native-stage-fixtures.ts";
test("source text preparation binds exact documents and every source witness", () => {
  expect(createNativeStageCommandPreparer({ operations: createNativeStageOperations() }).prepare(nativeStageRequest)).toEqual({ status: "ok", value: nativeStageCommands });
});
test("source API absence remains an explicit capability gap", () => {
  expect(createNativeStageCommandPreparer({ operations: createNativeStageOperations({ reply: { status: "unavailable", detail: "source API absent" } }) }).prepare(nativeStageRequest)).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "native-stage-commands", detail: "source API absent" }] });
});
test("unknown native routes retain the source refusal", () => {
  expect(createNativeStageCommandPreparer({ operations: createNativeStageOperations({ reply: { status: "refused", detail: "unknown owned route" } }) }).prepare(nativeStageRequest)).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "native-stage-commands", detail: "unknown owned route" }] });
});
test("a valid response cannot substitute another input body", () => {
  expect(createNativeStageCommandPreparer({ operations: createNativeStageOperations({ reply: { ...nativeStageReply, documents: [{ ...nativeStageDocument, source: "foreign" }] } }) }).prepare(nativeStageRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "native-stage-commands", detail: "native prepared texts must bind every requested path and input byte string once, with the declared source witnesses" }] });
});
test("omitting route source provenance cannot bypass admission", () => {
  expect(createNativeStageCommandPreparer({ operations: createNativeStageOperations({ reply: { ...nativeStageReply, inputs: [] } }) }).prepare(nativeStageRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "native-stage-commands", detail: "native prepared texts must bind every requested path and input byte string once, with the declared source witnesses" }] });
});
test("dispatcher provenance cannot substitute for the adopted static route contract", () => {
  expect(createNativeStageCommandPreparer({ operations: createNativeStageOperations({ reply: dispatcherStageReply }) }).prepare(nativeStageRequest)).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "native-stage-commands", detail: "native prepared texts must bind every requested path and input byte string once, with the declared source witnesses" }] });
});
test("permission documents are refused before source process execution", () => {
  const operations = createNativeStageOperations();
  expect(createNativeStageCommandPreparer({ operations }).prepare({ ...nativeStageRequest, documents: [{ path: ".claude/settings.json", source: "{}" }] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "native-stage-commands", detail: "prepare nonempty unique core stage documents within the selected harness's native phase/slug layout" }] });
  expect(operations.spawn).not.toHaveBeenCalled();
});
test("source process receives system environment without inherited credentials", () => {
  const operations = createNativeStageOperations();
  createNativeStageCommandPreparer({ operations }).prepare(nativeStageRequest);
  expect(operations.spawn).toHaveBeenCalledWith(expect.objectContaining({ env: expect.objectContaining(nativeStageExpectedEnvironment) }));
  expect(operations.spawn).not.toHaveBeenCalledWith(expect.objectContaining({ env: expect.objectContaining(nativeStageForbiddenEnvironment) }));
});
