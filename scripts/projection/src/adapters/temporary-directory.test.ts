import { expect, mock, test } from "bun:test";
import { collaboratorFault } from "../../../../tests/harness/collaborator-fault.ts";
import { createRuntimeFixtureFilesystem } from "../../../../tests/harness/runtime-fixture-filesystem.ts";
import { withTemporaryDirectory } from "../application/temporary-directory.ts";
import type { Outcome } from "../domain/model.ts";
import { createOwnedDirectories, type OwnedDirectories } from "./owned-directory.ts";
import { createOwnedTemporaryDirectoryOperations, createTemporaryDirectoryOperations } from "./temporary-directory.ts";

test("the async owned adapter delegates allocation and removal without a second ownership registry", async () => {
  const allocate = mock(() => "parent/owned");
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "removed" }));
  const operations = createOwnedTemporaryDirectoryOperations({ directories: { allocate, remove } });
  expect(await operations.remove({ root: "previously-owned" })).toEqual({ status: "ok", value: "removed" });
  expect(allocate).not.toHaveBeenCalled();
  expect(await operations.allocate()).toEqual({ status: "ok", value: "parent/owned" });
  expect(await operations.remove({ root: "parent/owned" })).toEqual({ status: "ok", value: "removed" });
  expect(remove.mock.calls).toEqual([[{ root: "previously-owned" }], [{ root: "parent/owned" }]]);
});

test("the async owned adapter reports allocation exceptions as capability gaps", async () => {
  const allocate = collaboratorFault(new Error("allocation unavailable"));
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "removed" }));
  const operations = createOwnedTemporaryDirectoryOperations({ directories: { allocate, remove } });
  expect(await operations.allocate()).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private directory allocation unavailable: allocation unavailable" }] });
  expect(remove).not.toHaveBeenCalled();
});

test("the async owned adapter reports cleanup exceptions as capability gaps", async () => {
  const remove = collaboratorFault(new Error("cleanup unavailable"));
  const operations = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  expect(await operations.remove({ root: "parent/owned" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private directory cleanup unavailable: cleanup unavailable" }] });
});

test("the async owned adapter maps a typed foreign-root refusal to foreign-content", async () => {
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "foreign-root" }));
  const operations = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  expect(await operations.remove({ root: "unowned" })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "unowned", detail: "cleanup requires a root allocated by this directory instance" }] });
  expect(remove.mock.calls).toEqual([[{ root: "unowned" }]]);
});

test("an owned lifecycle returns consumed work after successful cleanup", async () => {
  const allocate = mock(() => "parent/owned");
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "removed" }));
  const consume = mock(async (_directory: { readonly root: string }): Promise<Outcome<string>> => ({ status: "ok", value: "artifact" }));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate, remove } });
  expect(await withTemporaryDirectory({ directories, consume })).toEqual({ status: "ok", value: "artifact" });
  expect(consume.mock.calls).toEqual([[{ root: "parent/owned" }]]);
  expect(remove.mock.calls).toEqual([[{ root: "parent/owned" }]]);
  expect(allocate).toHaveBeenCalledTimes(1);
});

test("an owned lifecycle allocation failure never consumes or cleans a root", async () => {
  const allocate = collaboratorFault(new Error("allocation failed"));
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "removed" }));
  const consume = mock(async (_directory: { readonly root: string }): Promise<Outcome<string>> => ({ status: "ok", value: "unreachable" }));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate, remove } });
  expect(await withTemporaryDirectory({ directories, consume })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private directory allocation unavailable: allocation failed" }] });
  expect(consume).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

test("an owned lifecycle preserves invalid consumption and still cleans the root", async () => {
  const consumed: Outcome<string> = { status: "invalid", findings: [{ code: "foreign-content", subject: "artifact", detail: "consumer refused" }] };
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "removed" }));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  expect(await withTemporaryDirectory({ directories, consume: async () => consumed })).toEqual(consumed);
  expect(remove.mock.calls).toEqual([[{ root: "parent/owned" }]]);
});

test("an owned lifecycle converts thrown consumption and still cleans the root", async () => {
  const consume = mock<() => Promise<Outcome<string>>>().mockRejectedValue(new Error("consume failed"));
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "removed" }));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  expect(await withTemporaryDirectory({ directories, consume })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private producer work unavailable; no artifact issued: consume failed" }] });
  expect(remove.mock.calls).toEqual([[{ root: "parent/owned" }]]);
});

test("successful consumption cannot hide a cleanup refusal", async () => {
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "foreign-root" }));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  const consume = async (): Promise<Outcome<string>> => ({ status: "ok", value: "artifact" });
  expect(await withTemporaryDirectory({ directories, consume })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "parent/owned", detail: "cleanup requires a root allocated by this directory instance" }] });
});

test("successful consumption cannot hide a cleanup exception", async () => {
  const remove = collaboratorFault(new Error("cleanup failed"));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  const consume = async (): Promise<Outcome<string>> => ({ status: "ok", value: "artifact" });
  expect(await withTemporaryDirectory({ directories, consume })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "producer-workspace", detail: "private directory cleanup unavailable: cleanup failed" }] });
});

test("invalid consumption and a cleanup refusal preserve both findings in order", async () => {
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "foreign-root" }));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  const consume = async (): Promise<Outcome<string>> => ({ status: "invalid", findings: [{ code: "foreign-content", subject: "artifact", detail: "consumer refused" }] });
  expect(await withTemporaryDirectory({ directories, consume })).toEqual({ status: "invalid", findings: [
    { code: "foreign-content", subject: "artifact", detail: "consumer refused" },
    { code: "foreign-content", subject: "parent/owned", detail: "cleanup requires a root allocated by this directory instance" },
  ] });
});

test("thrown consumption and cleanup exceptions preserve both findings in order", async () => {
  const consume = mock<() => Promise<Outcome<string>>>().mockRejectedValue(new Error("consume failed"));
  const remove = collaboratorFault(new Error("cleanup failed"));
  const directories = createOwnedTemporaryDirectoryOperations({ directories: { allocate: () => "parent/owned", remove } });
  expect(await withTemporaryDirectory({ directories, consume })).toEqual({ status: "invalid", findings: [
    { code: "capability-gap", subject: "producer-workspace", detail: "private producer work unavailable; no artifact issued: consume failed" },
    { code: "capability-gap", subject: "producer-workspace", detail: "private directory cleanup unavailable: cleanup failed" },
  ] });
});

test("async cleanup failure retains the original owner's authority for retry", async () => {
  const remove = mock<(root: string) => void>(() => undefined).mockImplementationOnce(collaboratorFault(new Error("cleanup failed")));
  const owner = createOwnedDirectories({ parent: "parent", storage: { create: () => "parent/owned", remove } });
  const directories = createOwnedTemporaryDirectoryOperations({ directories: owner });
  expect(await directories.allocate()).toEqual({ status: "ok", value: "parent/owned" });
  expect(await directories.remove({ root: "parent/owned" })).toMatchObject({ status: "invalid" });
  expect(await directories.remove({ root: "parent/owned" })).toEqual({ status: "ok", value: "removed" });
  expect(await directories.remove({ root: "parent/owned" })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "parent/owned", detail: "cleanup requires a root allocated by this directory instance" }] });
  expect(remove.mock.calls).toEqual([["parent/owned"], ["parent/owned"]]);
});

test("standalone shell default integration allocates privately and cleans its own root", async () => {
  const filesystem = createRuntimeFixtureFilesystem();
  const directories = createTemporaryDirectoryOperations();
  const consume = mock(async ({ root }: { readonly root: string }): Promise<Outcome<string>> => ({ status: "ok", value: root }));
  const consumed = await withTemporaryDirectory({ directories, consume });
  expect(consumed.status).toBe("ok");
  expect(consume).toHaveBeenCalledTimes(1);
  const root = consume.mock.calls[0]![0].root;
  expect(filesystem.observe(root).presence).toBe("absent");
  expect(filesystem.observe(root).parent).toBe(filesystem.temporaryRoot);
  expect(await directories.remove({ root })).toMatchObject({ status: "invalid" });
  expect(await directories.remove({ root: filesystem.temporaryRoot })).toMatchObject({ status: "invalid" });
});
