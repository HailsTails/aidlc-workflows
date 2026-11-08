import { afterEach, expect, mock, test } from "bun:test";
import { collaboratorFault } from "../../../../tests/harness/collaborator-fault.ts";
import { createRuntimeFixtureFilesystem } from "../../../../tests/harness/runtime-fixture-filesystem.ts";
import type { OwnedDirectories } from "./owned-directory.ts";
import { createChildRuntimeDirectories } from "./child-runtime-directory.ts";
import { createDistributionDirectoryFactory, createDistributionSessionDirectories, removeDistributionDirectory } from "./distribution-directory.ts";

const filesystem = createRuntimeFixtureFilesystem();
afterEach(filesystem.cleanup);

test("distribution factories give every caller a separate directory owner", () => {
  const create = mock<(parent: string) => string>(() => "parent/second").mockReturnValueOnce("parent/first");
  const remove = mock<(root: string) => void>(() => undefined);
  const factory = createDistributionDirectoryFactory({ parent: "parent", storage: { create, remove } });
  const first = factory();
  const second = factory();
  expect(first).not.toBe(second);
  const firstRoot = first.allocate();
  const secondRoot = second.allocate();
  expect(first.remove({ root: secondRoot })).toEqual({ status: "foreign-root" });
  expect(second.remove({ root: firstRoot })).toEqual({ status: "foreign-root" });
  expect(first.remove({ root: "parent" })).toEqual({ status: "foreign-root" });
  expect(remove).not.toHaveBeenCalled();
  expect(first.remove({ root: firstRoot })).toEqual({ status: "removed" });
  expect(second.remove({ root: secondRoot })).toEqual({ status: "removed" });
  expect(create.mock.calls).toEqual([["parent"], ["parent"]]);
});

test("distribution allocation exceptions preserve the storage failure", () => {
  const failure = new Error("distribution allocation failed");
  const remove = mock<(root: string) => void>(() => undefined);
  const factory = createDistributionDirectoryFactory({ parent: "parent", storage: { create: collaboratorFault(failure), remove } });
  const directories = factory();
  expect(directories.allocate).toThrow(failure);
  expect(directories.remove({ root: "parent/failed" })).toEqual({ status: "foreign-root" });
  expect(remove).not.toHaveBeenCalled();
});

test("distribution cleanup can retry after storage failure and refuses double cleanup", () => {
  const remove = mock<(root: string) => void>(() => undefined).mockImplementationOnce(collaboratorFault(new Error("distribution cleanup failed")));
  const directories = createDistributionDirectoryFactory({ parent: "parent", storage: { create: () => "parent/owned", remove } })();
  const root = directories.allocate();
  expect(() => removeDistributionDirectory({ directories, root })).toThrow("distribution cleanup failed");
  removeDistributionDirectory({ directories, root });
  expect(() => removeDistributionDirectory({ directories, root })).toThrow("foreign-root cleanup is programmer misuse");
  expect(remove.mock.calls).toEqual([[root], [root]]);
});

test("the synchronous distribution bridge reports a typed foreign-root refusal", () => {
  const remove = mock<OwnedDirectories["remove"]>(() => ({ status: "foreign-root" }));
  const directories = { allocate: () => "parent/owned", remove };
  expect(() => removeDistributionDirectory({ directories, root: "foreign" })).toThrow("foreign-root cleanup is programmer misuse");
  expect(remove.mock.calls).toEqual([[{ root: "foreign" }]]);
});

test("distribution session parents are discovered once and roots stay lazy", () => {
  const temporaryParent = mock(() => "caller-temp");
  const create = mock<(parent: string) => string>(() => "caller-temp/session");
  const remove = mock<(root: string) => void>(() => undefined);
  const directories = createDistributionSessionDirectories({ storage: { temporaryParent, create, remove } });
  expect(temporaryParent).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
  expect(directories.allocate()).toBe("caller-temp/session");
  expect(create.mock.calls).toEqual([["caller-temp"]]);
  expect(directories.remove({ root: "caller-temp/session" })).toEqual({ status: "removed" });
  expect(remove.mock.calls).toEqual([["caller-temp/session"]]);
});

test("distribution session discovery failures have no allocation or cleanup effects", () => {
  const temporaryParent = collaboratorFault(new Error("temporary parent unavailable"));
  const create = mock<(parent: string) => string>(() => "unallocated");
  const remove = mock<(root: string) => void>(() => undefined);
  expect(() => createDistributionSessionDirectories({ storage: { temporaryParent, create, remove } })).toThrow("temporary parent unavailable");
  expect(create).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

test("explicit distribution parents never discover ambient temporary directories", () => {
  const temporaryParent = mock(collaboratorFault(new Error("ambient discovery forbidden")));
  const create = mock<(parent: string) => string>(() => "explicit-parent/owned");
  const remove = mock<(root: string) => void>(() => undefined);
  const storage = { temporaryParent, create, remove };
  const factory = createDistributionDirectoryFactory({ parent: "explicit-parent", storage });
  const directories = factory();
  const root = directories.allocate();
  removeDistributionDirectory({ directories, root });
  expect(temporaryParent).not.toHaveBeenCalled();
  expect(create.mock.calls).toEqual([["explicit-parent"]]);
});

test("distribution and runtime integration owns separate siblings and rejects cross-cleanup", () => {
  const parent = filesystem.create({ prefix: "distribution-test-" });
  const runtime = createChildRuntimeDirectories({ parent });
  const distributions = createDistributionDirectoryFactory({ parent });
  const first = distributions();
  const second = distributions();
  const runtimeRoot = runtime.allocate();
  const firstRoot = first.allocate();
  const secondRoot = second.allocate();
  expect(new Set([runtimeRoot, firstRoot, secondRoot]).size).toBe(3);
  expect(filesystem.observe(firstRoot).parent).toBe(parent);
  expect(filesystem.observe(secondRoot).parent).toBe(parent);
  expect(filesystem.observe(runtimeRoot).parent).toBe(parent);
  expect(() => runtime.remove({ root: firstRoot })).toThrow("Runtime cleanup requires a root allocated by this directory instance");
  expect(first.remove({ root: runtimeRoot })).toEqual({ status: "foreign-root" });
  expect(first.remove({ root: secondRoot })).toEqual({ status: "foreign-root" });
  expect(first.remove({ root: parent })).toEqual({ status: "foreign-root" });
  filesystem.write({ root: secondRoot, relative: "sentinel", text: "sibling" });
  removeDistributionDirectory({ directories: first, root: firstRoot });
  expect(filesystem.observe(firstRoot).presence).toBe("absent");
  expect(filesystem.observe(runtimeRoot).presence).toBe("present");
  expect(filesystem.read({ root: secondRoot, relative: "sentinel" })).toBe("sibling");
  removeDistributionDirectory({ directories: second, root: secondRoot });
  runtime.remove({ root: runtimeRoot });
});

test("default distribution session integration uses the caller temp and cleans its own root", () => {
  const directories = createDistributionSessionDirectories();
  const root = directories.allocate();
  const observed = filesystem.observe(root);
  removeDistributionDirectory({ directories, root });
  expect(observed.parent).toBe(filesystem.temporaryRoot);
  expect(observed.presence).toBe("present");
  expect(filesystem.observe(root).presence).toBe("absent");
});
