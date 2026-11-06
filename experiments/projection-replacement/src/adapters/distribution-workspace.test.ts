import { expect, test, mock } from "bun:test";
import { createDistributionWorkspace, createDistributionWorkspaceOperations } from "./distribution-workspace.ts";
import { createWorkspaceOperationsFixture, consumePrivateWorkspace, unavailableWorkspaceWrite } from "../../__tests__/workflow-runtime-fixtures.ts";
import { distributionSeed } from "../../__tests__/distribution-fixtures.ts";
test("a private snapshot is consumed and its allocated root is always released", async () => {
  const operations = createWorkspaceOperationsFixture();
  expect(await createDistributionWorkspace({ operations }).run({ seed: distributionSeed, sourceRoot: "source", consume: consumePrivateWorkspace })).toEqual({ status: "ok", value: "private-root/runtime" });
  expect(operations.materialize).toHaveBeenCalledWith({ root: "private-root", seed: distributionSeed, sourceRoot: "source" });
  expect(operations.remove).toHaveBeenCalledWith({ root: "private-root" });
});
test("partial staging failure releases its private root and never invokes the consumer", async () => {
  const operations = createWorkspaceOperationsFixture();
  const consume = mock();
  expect(await createDistributionWorkspace({ operations: { ...operations, materialize: unavailableWorkspaceWrite() } }).run({ seed: distributionSeed, sourceRoot: "source", consume })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private producer work unavailable; no artifact issued: staging write failed" }] });
  expect(consume).not.toHaveBeenCalled();
  expect(operations.remove).toHaveBeenCalledWith({ root: "private-root" });
});
test("composition: explicit materialization refusal releases staging without consuming it", async () => {
  const operations = createWorkspaceOperationsFixture();
  const consume = mock();
  expect(await createDistributionWorkspace({ operations: { ...operations, materialize: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-archive", detail: "native archive producer must return byte contents" }] }) } }).run({ seed: distributionSeed, sourceRoot: "source", consume })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-archive", detail: "native archive producer must return byte contents" }] });
  expect(consume).not.toHaveBeenCalled();
  expect(operations.remove).toHaveBeenCalledWith({ root: "private-root" });
});
test("a consumer failure also releases its private runtime", async () => {
  const operations = createWorkspaceOperationsFixture();
  expect(await createDistributionWorkspace({ operations }).run({ seed: distributionSeed, sourceRoot: "source", consume: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "invalid-input", subject: "consumer", detail: "incomplete native output" }] }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "consumer", detail: "incomplete native output" }] });
  expect(operations.remove).toHaveBeenCalledWith({ root: "private-root" });
});
test("production cleanup refuses a root that this workspace never allocated", async () => {
  expect(await createDistributionWorkspaceOperations().remove({ root: "H:/private/user-files" })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "H:/private/user-files", detail: "cleanup requires a root allocated by this directory instance" }] });
});
