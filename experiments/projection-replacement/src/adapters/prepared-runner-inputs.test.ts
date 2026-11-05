import { expect, mock, test } from "bun:test";
import { createPreparedRunnerInputs, createPreparedRunnerInputOperations } from "./prepared-runner-inputs.ts";
import { createPreparedInputOperationsFixture, preparedLocation, preparedInputSnapshot, malformedPreparedInventory, mismatchedPreparedInventory, missingPreparedMetadata, unsafePreparedInventory, duplicatePreparedInventory } from "../../__tests__/prepared-runner-fixtures.ts";
test("admits explicit prepared inputs with open native metadata and no projection descriptor", async () => {
  expect(await createPreparedRunnerInputs({ operations: createPreparedInputOperationsFixture() }).load({ location: preparedLocation })).toEqual({ status: "ok", value: preparedInputSnapshot });
});
test("invalid harness JSON is an input failure rather than compiler unavailability", async () => {
  expect(await createPreparedRunnerInputs({ operations: { snapshot: mock().mockResolvedValue(malformedPreparedInventory) } }).load({ location: preparedLocation })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "prepared-runner-inputs", detail: "prepared harness metadata must be valid JSON" }] });
});
test("a stamp or caller binding cannot excuse contradictory harness metadata", async () => {
  expect(await createPreparedRunnerInputs({ operations: { snapshot: mock().mockResolvedValue(mismatchedPreparedInventory) } }).load({ location: preparedLocation })).toEqual({ status: "invalid", findings: [{ code: "harness-mismatch", subject: "prepared-runner-inputs", detail: "prepared harness metadata must declare version 1, the requested binding and native rules directory" }] });
});
test("missing metadata cannot be filled with a guessed host policy", async () => {
  expect(await createPreparedRunnerInputs({ operations: { snapshot: mock().mockResolvedValue(missingPreparedMetadata) } }).load({ location: preparedLocation })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-runner-inputs", detail: "prepared runtime must include harness metadata" }] });
});
test("unsafe inventory paths are refused before admission", async () => {
  expect(await createPreparedRunnerInputs({ operations: { snapshot: mock().mockResolvedValue(unsafePreparedInventory) } }).load({ location: preparedLocation })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "prepared-runner-inputs", detail: "prepared input snapshot requires safe file paths, byte contents and directory paths" }] });
});
test("duplicate input files cannot hide behind first-match metadata", async () => {
  expect(await createPreparedRunnerInputs({ operations: { snapshot: mock().mockResolvedValue(duplicatePreparedInventory) } }).load({ location: preparedLocation })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "prepared-runner-inputs", detail: "prepared input files and directories must each be unique" }] });
});
test("storage unavailability retains actionable failure data", async () => {
  expect(await createPreparedRunnerInputs({ operations: { snapshot: mock().mockRejectedValue(new Error("graph file unavailable")) } }).load({ location: preparedLocation })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "prepared-runner-inputs", detail: "prepared runner inputs unavailable: graph file unavailable" }] });
});
test("production snapshot capability remains deferred", () => {
  expect(createPreparedRunnerInputOperations()).toEqual({ snapshot: expect.any(Function) });
});
