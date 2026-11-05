import { expect, mock, test } from "bun:test";
import { prepareStageCommands, stageProjectionUnits } from "./stage-command-preparation.ts";
import { authoredStage } from "../../__tests__/stage-fixtures.ts";
import { scopeContext } from "../../__tests__/scope-fixtures.ts";
import { nativeStageCommands, nativeStageRequest } from "../../__tests__/native-stage-fixtures.ts";
test("copy delivery does not require native source APIs", () => {
  const preparer = { prepare: mock() };
  expect(prepareStageCommands({ ...nativeStageRequest, stages: [authoredStage], context: scopeContext, preparer })).toEqual({ status: "ok", value: null });
  expect(preparer.prepare).not.toHaveBeenCalled();
});
test("native preparation receives substituted prose before command routing", () => {
  const preparer = { prepare: mock().mockReturnValue({ status: "ok", value: nativeStageCommands }) };
  expect(prepareStageCommands({ ...nativeStageRequest, stages: [authoredStage], context: { ...scopeContext, invocation: "aidlc" }, preparer })).toEqual({ status: "ok", value: nativeStageCommands });
  expect(preparer.prepare).toHaveBeenCalledWith({ ...nativeStageRequest, binding: { ...scopeContext, invocation: "aidlc" } });
});
test("projection composition binds each stage to its own prepared document", () => {
  expect(stageProjectionUnits({ stages: [authoredStage], context: { ...scopeContext, invocation: "aidlc" }, commands: nativeStageCommands })).toEqual([{ kind: "stage", key: "stage-code-generation", input: { stage: authoredStage, context: { ...scopeContext, invocation: "aidlc", nativeCommands: nativeStageCommands.documents[0] } } }]);
});
