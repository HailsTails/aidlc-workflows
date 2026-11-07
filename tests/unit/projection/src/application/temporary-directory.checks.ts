import { expect, mock, test } from "bun:test";
import { withTemporaryDirectory } from "../../../../../scripts/projection/src/application/temporary-directory.ts";
import { createTemporaryDirectoryFixture, rejectDirectoryConsumer, rejectDirectoryRemoval, directoryFailure, workflowBuildFailure } from "../../support/__tests__/workflow-publication-fixtures.ts";
test("a successful consumer is returned after private cleanup", async () => {
  const directories = createTemporaryDirectoryFixture();
  expect(await withTemporaryDirectory({ directories, consume: mock().mockResolvedValue({ status: "ok", value: "built" }) })).toEqual({ status: "ok", value: "built" });
  expect(directories.remove).toHaveBeenCalledWith({ root: "private-root" });
});
test("allocation refusal cannot run a consumer or cleanup another root", async () => {
  const directories = createTemporaryDirectoryFixture(), consume = mock();
  expect(await withTemporaryDirectory({ directories: { ...directories, allocate: mock().mockResolvedValue(directoryFailure) }, consume })).toEqual(directoryFailure);
  expect(consume).not.toHaveBeenCalled();
  expect(directories.remove).not.toHaveBeenCalled();
});
test("a rejected consumer is converted to data and still released", async () => {
  const directories = createTemporaryDirectoryFixture();
  expect(await withTemporaryDirectory({ directories, consume: rejectDirectoryConsumer() })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private producer work unavailable; no artifact issued: consumer interrupted" }] });
  expect(directories.remove).toHaveBeenCalledWith({ root: "private-root" });
});
test("cleanup failure cannot leak a successful artifact", async () => {
  expect(await withTemporaryDirectory({ directories: { ...createTemporaryDirectoryFixture(), remove: mock().mockResolvedValue(directoryFailure) }, consume: mock().mockResolvedValue({ status: "ok", value: "built" }) })).toEqual(directoryFailure);
});
test("a cleanup exception remains a failure result", async () => {
  expect(await withTemporaryDirectory({ directories: { ...createTemporaryDirectoryFixture(), remove: rejectDirectoryRemoval() }, consume: mock().mockResolvedValue({ status: "ok", value: "built" }) })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private directory lifecycle unavailable; no artifact issued: cleanup interrupted" }] });
});
test("cleanup refusal preserves the original preparation guidance too", async () => {
  expect(await withTemporaryDirectory({ directories: { ...createTemporaryDirectoryFixture(), remove: mock().mockResolvedValue(directoryFailure) }, consume: mock().mockResolvedValue(workflowBuildFailure) })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "source-api", detail: "native text API absent" }, { code: "capability-gap", subject: "producer-workspace", detail: "cleanup unavailable" }] });
});
