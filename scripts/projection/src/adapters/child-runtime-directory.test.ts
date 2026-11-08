import { collaboratorFault } from "../../../../tests/harness/collaborator-fault.ts";
import { afterEach, expect, mock, test } from "bun:test";
import { createChildRuntimeDirectories, createChildRuntimeSessionDirectories } from "./child-runtime-directory.ts";
import { privateCompilerEnvironment } from "./native-compiler-process.ts";
import { allocateOverlappingRuntimeHomes, createAllocationFailureStorageFixture, createCleanupFailureStorageFixture, createRuntimeDirectoryFixtures, readRuntimeValue, runtimeDirectoryExists, runtimeDirectoryParent, runtimeTemporaryRoot, runtimeHomeParents, writeRuntimeValue } from "../../../../tests/unit/projection/support/child-runtime-fixture.ts";
import "../../../../tests/unit/projection/support/child-runtime-fixture.test.ts";

const fixtures = createRuntimeDirectoryFixtures();
afterEach(fixtures.cleanup);

test("runtime directories own distinct shallow homes and reject foreign or repeated cleanup", () => {
  const parent = fixtures.create();
  const owner = createChildRuntimeDirectories({ parent });
  const other = createChildRuntimeDirectories({ parent });
  const first = owner.allocate();
  const second = other.allocate();
  expect(runtimeDirectoryParent(first)).toBe(parent);
  expect(first).not.toBe(second);
  writeRuntimeValue({ root: first, text: "first" });
  writeRuntimeValue({ root: second, text: "second" });
  expect(() => owner.remove({ root: second })).toThrow("allocated by this directory instance");
  expect(() => owner.remove({ root: parent })).toThrow("allocated by this directory instance");
  owner.remove({ root: first });
  expect(runtimeDirectoryExists(first)).toBe(false);
  expect(readRuntimeValue(second)).toBe("second");
  expect(() => owner.remove({ root: first })).toThrow("allocated by this directory instance");
  other.remove({ root: second });
  expect(runtimeDirectoryExists(second)).toBe(false);
});

test("runtime allocation failure grants no cleanup authority", () => {
  const fixture = createAllocationFailureStorageFixture();
  const owner = createChildRuntimeDirectories({ parent: "caller-temp", storage: fixture.storage });
  expect(owner.allocate).toThrow("allocation failed");
  expect(() => owner.remove({ root: "caller-temp" })).toThrow("allocated by this directory instance");
  expect(fixture.removed).toEqual([]);
});

test("runtime cleanup failure is visible and retains ownership for a retry", () => {
  const fixture = createCleanupFailureStorageFixture();
  const owner = createChildRuntimeDirectories({ parent: "caller-temp", storage: fixture.storage });
  const root = owner.allocate();
  expect(() => owner.remove({ root })).toThrow("cleanup failed");
  fixture.recover();
  owner.remove({ root });
  expect(fixture.removed).toEqual(["caller-temp/owned"]);
  expect(() => owner.remove({ root })).toThrow("allocated by this directory instance");
});

test("overlapping runtime sessions and emission homes cannot clean each other", async () => {
  const parent = fixtures.create();
  const sessions = createChildRuntimeDirectories({ parent });
  const first = sessions.allocate();
  const second = sessions.allocate();
  const left = createChildRuntimeDirectories({ parent: first });
  const right = createChildRuntimeDirectories({ parent: second });
  const homes = await allocateOverlappingRuntimeHomes({ left, right });
  expect(new Set(homes).size).toBe(3);
  expect(runtimeHomeParents(homes)).toEqual([first, first, second]);
  expect(() => left.remove({ root: homes[2]! })).toThrow("allocated by this directory instance");
  sessions.remove({ root: first });
  expect(runtimeDirectoryExists(homes[0]!)).toBe(false);
  expect(runtimeDirectoryExists(homes[1]!)).toBe(false);
  expect(runtimeDirectoryExists(homes[2]!)).toBe(true);
  right.remove({ root: homes[2]! });
  sessions.remove({ root: second });
});

test("child runtime environment changes only the explicit child home and temp", () => {
  const inherited = Object.fromEntries([["PATH", "path"], ["TEMP", "parent-temp"], ["HOME", "parent-home"], ["SECRET", "unforwarded"]]);
  const environment = privateCompilerEnvironment({ inherited, root: "session/emission" });
  expect(environment["HOME"]).toBe("session/emission");
  expect(environment["TEMP"]).toBe("session/emission");
  expect(environment["BUN_TMPDIR"]).toBe("session/emission");
  expect(environment["PATH"]).toBe("path");
  expect(environment["SECRET"]).toBeUndefined();
  expect(inherited["TEMP"]).toBe("parent-temp");
  expect(inherited["HOME"]).toBe("parent-home");
  expect(inherited["SECRET"]).toBe("unforwarded");
});


test("runtime session capability obtains its parent from the injected storage host", () => {
  const temporaryParent = mock(() => "declared-temp");
  const create = mock((parent: string) => `${parent}/owned`);
  const remove = mock<(root: string) => void>(() => undefined);
  const owner = createChildRuntimeSessionDirectories({ storage: { temporaryParent, create, remove } });
  expect(temporaryParent).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(owner.allocate()).toBe("declared-temp/owned");
  expect(create.mock.calls).toEqual([["declared-temp"]]);
  owner.remove({ root: "declared-temp/owned" });
  expect(remove.mock.calls).toEqual([["declared-temp/owned"]]);
  expect(temporaryParent).toHaveBeenCalledTimes(1);
});

test("runtime session temp discovery failure cannot allocate or remove directories", () => {
  const temporaryParent = mock(collaboratorFault(new Error("temp discovery failed")));
  const create = mock(() => "not-allocated");
  const remove = mock<(root: string) => void>(() => undefined);
  expect(() => createChildRuntimeSessionDirectories({ storage: { temporaryParent, create, remove } })).toThrow("temp discovery failed");
  expect(create).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});


test("explicit emission parents do not discover ambient temporary roots", () => {
  const temporaryParent = mock(collaboratorFault(new Error("ambient discovery forbidden")));
  const create = mock((parent: string) => `${parent}/owned`);
  const remove = mock<(root: string) => void>(() => undefined);
  const storage = { temporaryParent, create, remove };
  const owner = createChildRuntimeDirectories({ parent: "explicit-session", storage });
  expect(owner.allocate()).toBe("explicit-session/owned");
  owner.remove({ root: "explicit-session/owned" });
  expect(create.mock.calls).toEqual([["explicit-session"]]);
  expect(remove.mock.calls).toEqual([["explicit-session/owned"]]);
  expect(temporaryParent).not.toHaveBeenCalled();
});

test("default runtime sessions allocate beneath the caller temp and own cleanup", () => {
  const owner = createChildRuntimeSessionDirectories();
  const root = owner.allocate();
  const parent = runtimeDirectoryParent(root);
  const allocated = runtimeDirectoryExists(root);
  owner.remove({ root });
  expect(parent).toBe(runtimeTemporaryRoot);
  expect(allocated).toBe(true);
  expect(runtimeDirectoryExists(root)).toBe(false);
});
