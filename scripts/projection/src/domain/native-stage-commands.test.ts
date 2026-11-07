import { expect, test } from "bun:test";
import { renderStageDefinition } from "./stage-definition.ts";
import { authoredStage } from "../../../../tests/unit/projection/support/__tests__/stage-fixtures.ts";
import { scopeContext } from "../../../../tests/unit/projection/support/__tests__/scope-fixtures.ts";
import { nativeStageCommands, nativeStageProjection, nativeStageDocument } from "../../../../tests/unit/projection/support/__tests__/native-stage-fixtures.ts";
test("native stage rendering preserves source-prepared bytes and provenance", () => {
  expect(renderStageDefinition({ stage: authoredStage, context: { ...scopeContext, invocation: "aidlc", nativeCommands: nativeStageCommands.documents[0] } })).toEqual({ status: "ok", value: nativeStageProjection });
});
test("foreign preparation cannot override authored stage body", () => {
  expect(renderStageDefinition({ stage: authoredStage, context: { ...scopeContext, invocation: "aidlc", nativeCommands: { ...nativeStageCommands.documents[0], source: "different" } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/aidlc-common/stages/construction/code-generation.md", detail: "native stage commands must match the native delivery, exact authored prose/path and source basis" }] });
});
test("unwitnessed native text cannot bypass source preparation", () => {
  expect(renderStageDefinition({ stage: authoredStage, context: { ...scopeContext, invocation: "aidlc", nativeCommands: { ...nativeStageDocument, origins: [] } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/aidlc-common/stages/construction/code-generation.md", detail: "native stage commands must match the native delivery, exact authored prose/path and source basis" }] });
});
test("another source pin cannot prepare this stage's native commands", () => {
  expect(renderStageDefinition({ stage: authoredStage, context: { ...scopeContext, invocation: "aidlc", nativeCommands: { ...nativeStageDocument, origins: [{ ...authoredStage.origin, pin: "cc6f50d678da7a7a0228e47bb7429ed22f952a77" }] } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/aidlc-common/stages/construction/code-generation.md", detail: "native stage commands must match the native delivery, exact authored prose/path and source basis" }] });
});
test("native prepared text cannot replace copy delivery", () => {
  expect(renderStageDefinition({ stage: authoredStage, context: { ...scopeContext, nativeCommands: nativeStageCommands.documents[0] } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core/aidlc-common/stages/construction/code-generation.md", detail: "native stage commands must match the native delivery, exact authored prose/path and source basis" }] });
});
