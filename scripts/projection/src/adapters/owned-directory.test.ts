import { expect, mock, test } from "bun:test";
import { collaboratorFault } from "../../../../tests/harness/collaborator-fault.ts";
import { createOwnedDirectories } from "./owned-directory.ts";

// The ownership unit receives only controlled storage; native effects have separate integration tests.
test("owned directories allocate through the supplied storage once", () => {
  const create = mock<(parent: string) => string>(() => "parent/owned");
  const remove = mock<(root: string) => void>(() => undefined);
  const directories = createOwnedDirectories({ parent: "parent", storage: { create, remove } });
  expect(directories.allocate()).toBe("parent/owned");
  expect(create.mock.calls).toEqual([["parent"]]);
  expect(remove).not.toHaveBeenCalled();
  expect(directories.remove({ root: "parent/owned" })).toEqual({ status: "removed" });
  expect(remove.mock.calls).toEqual([["parent/owned"]]);
});

test("failed allocation grants no ownership", () => {
  const create = mock(collaboratorFault(new Error("allocation failed")));
  const remove = mock<(root: string) => void>(() => undefined);
  const directories = createOwnedDirectories({ parent: "parent", storage: { create, remove } });
  expect(directories.allocate).toThrow("allocation failed");
  expect(directories.remove({ root: "parent/owned" })).toEqual({ status: "foreign-root" });
  expect(directories.remove({ root: "parent" })).toEqual({ status: "foreign-root" });
  expect(remove).not.toHaveBeenCalled();
});

test("owned directories refuse foreign and parent roots without storage effects", () => {
  const create = mock<(parent: string) => string>(() => "parent/owned");
  const remove = mock<(root: string) => void>(() => undefined);
  const directories = createOwnedDirectories({ parent: "parent", storage: { create, remove } });
  directories.allocate();
  expect(directories.remove({ root: "parent" })).toEqual({ status: "foreign-root" });
  expect(directories.remove({ root: "unrelated" })).toEqual({ status: "foreign-root" });
  expect(remove).not.toHaveBeenCalled();
  expect(directories.remove({ root: "parent/owned" })).toEqual({ status: "removed" });
});

test("owners sharing storage cannot remove each other's roots", () => {
  const create = mock<(parent: string) => string>(() => "parent/second").mockReturnValueOnce("parent/first");
  const remove = mock<(root: string) => void>(() => undefined);
  const storage = { create, remove };
  const first = createOwnedDirectories({ parent: "parent", storage });
  const second = createOwnedDirectories({ parent: "parent", storage });
  const firstRoot = first.allocate();
  const secondRoot = second.allocate();
  expect(first.remove({ root: secondRoot })).toEqual({ status: "foreign-root" });
  expect(second.remove({ root: firstRoot })).toEqual({ status: "foreign-root" });
  expect(remove).not.toHaveBeenCalled();
  expect(first.remove({ root: firstRoot })).toEqual({ status: "removed" });
  expect(second.remove({ root: secondRoot })).toEqual({ status: "removed" });
});

test("successful cleanup releases its ownership exactly once", () => {
  const remove = mock<(root: string) => void>(() => undefined);
  const directories = createOwnedDirectories({ parent: "parent", storage: { create: () => "parent/owned", remove } });
  const root = directories.allocate();
  expect(directories.remove({ root })).toEqual({ status: "removed" });
  expect(directories.remove({ root })).toEqual({ status: "foreign-root" });
  expect(remove).toHaveBeenCalledTimes(1);
});

test("failed cleanup preserves ownership for a later successful retry", () => {
  const remove = mock<(root: string) => void>(() => undefined).mockImplementationOnce(collaboratorFault(new Error("cleanup failed")));
  const directories = createOwnedDirectories({ parent: "parent", storage: { create: () => "parent/owned", remove } });
  const root = directories.allocate();
  expect(() => directories.remove({ root })).toThrow("cleanup failed");
  expect(directories.remove({ root })).toEqual({ status: "removed" });
  expect(directories.remove({ root })).toEqual({ status: "foreign-root" });
  expect(remove.mock.calls).toEqual([[root], [root]]);
});
