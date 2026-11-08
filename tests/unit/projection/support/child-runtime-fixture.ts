import { createRuntimeFixtureFilesystem } from "../../../harness/runtime-fixture-filesystem.ts";
import type { ChildRuntimeDirectories } from "../../../../scripts/projection/src/adapters/child-runtime-directory.ts";

const filesystem = createRuntimeFixtureFilesystem();
export const runtimeTemporaryRoot = filesystem.temporaryRoot;
export const createRuntimeDirectoryFixture = () => filesystem.create({ prefix: "runtime-test-" });
export const removeRuntimeDirectoryFixture = (root: string) => filesystem.remove({ root });
export const runtimeDirectoryExists = (root: string) => (filesystem.observe(root).presence === "present");
export const runtimeDirectoryParent = (root: string) => filesystem.observe(root).parent;
export const writeRuntimeValue = ({ root, text }: { readonly root: string; readonly text: string }) => {
  filesystem.write({ root, relative: "cache/value", text });
};
export const readRuntimeValue = (root: string) => filesystem.read({ root, relative: "cache/value" });
export const createAllocationFailureStorageFixture = () => {
  const removed: string[] = [];
  return { removed, storage: {
    create: () => { throw new Error("allocation failed"); }, remove: (root: string) => { removed.push(root); },
  } };
};
export const createCleanupFailureStorageFixture = () => {
  let failed = true;
  const removed: string[] = [];
  return { removed, recover: () => { failed = false; }, storage: {
    create: (parent: string) => `${parent}/owned`, remove: (root: string) => { if (failed) throw new Error("cleanup failed"); removed.push(root); },
  } };
};
export const allocateOverlappingRuntimeHomes = async ({ left, right }: { readonly left: ChildRuntimeDirectories; readonly right: ChildRuntimeDirectories }) => Promise.all([Promise.resolve().then(left.allocate), Promise.resolve().then(left.allocate), Promise.resolve().then(right.allocate)]);
export const runtimeHomeParents = (homes: readonly string[]) => homes.map(home => filesystem.observe(home).parent);

export const createRuntimeDirectoryFixtures = () => {
  const roots = new Set<string>();
  return {
    create: () => { const root = createRuntimeDirectoryFixture(); roots.add(root); return root; },
    cleanup: () => { roots.forEach(root => { removeRuntimeDirectoryFixture(root); }); roots.clear(); },
  };
};
