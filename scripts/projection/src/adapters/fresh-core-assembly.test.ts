import { afterEach, expect, mock, test } from "bun:test";
import { createRuntimeFixtureFilesystem } from "../../../../tests/harness/runtime-fixture-filesystem.ts";
import { createChildRuntimeSessionDirectories } from "./child-runtime-directory.ts";
import { createDistributionSessionDirectories } from "./distribution-directory.ts";
import { admitFreshCoreDirectories } from "./fresh-core-assembly.ts";
import { withFreshCoreDirectories } from "./fresh-core-directories.ts";
import { createSessionDirectoryStorage } from "./session-directory-storage.ts";

type FreshCoreConsume = Parameters<typeof withFreshCoreDirectories<string>>[0]["consume"];
const filesystem = createRuntimeFixtureFilesystem();
afterEach(filesystem.cleanup);

test("fresh core admits allocated siblings when the temporary parent also contains authored source", async () => {
  const parent = filesystem.create({ prefix: "fresh-core-admission-" });
  filesystem.write({ root: parent, relative: "authored/sentinel", text: "authored bytes\r\n" });
  const sourceRoot = filesystem.path({ root: parent, relative: "authored" });
  const runtimeDirectories = createChildRuntimeSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "runtime" }), temporaryParent: () => parent } });
  const distributionDirectories = createDistributionSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "distribution" }), temporaryParent: () => parent } });
  const spawn = mock(async () => "issued");
  const consume = mock<FreshCoreConsume>(async roots => {
    expect(filesystem.observe(sourceRoot).parent).toBe(parent);
    expect(filesystem.observe(roots.runtimeRoot).parent).toBe(parent);
    expect(filesystem.observe(roots.distributionRoot).parent).toBe(parent);
    expect(filesystem.observe(roots.runtimeRoot).presence).toBe("present");
    expect(filesystem.observe(roots.distributionRoot).presence).toBe("present");
    expect(new Set([sourceRoot, roots.runtimeRoot, roots.distributionRoot]).size).toBe(3);
    admitFreshCoreDirectories({ sourceRoot, ...roots });
    return spawn();
  });
  const issued = await withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume });
  expect(issued).toBe("issued");
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(consume).toHaveBeenCalledTimes(1);
  const [roots] = consume.mock.calls[0]!;
  expect(filesystem.observe(roots.runtimeRoot).presence).toBe("absent");
  expect(filesystem.observe(roots.distributionRoot).presence).toBe("absent");
  expect(filesystem.read({ root: sourceRoot, relative: "sentinel" })).toBe("authored bytes\r\n");
  expect(filesystem.observe(parent).presence).toBe("present");
});

test.each([
  { overlap: "runtime", runtimeParent: "authored", distributionParent: "" },
  { overlap: "distribution", runtimeParent: "", distributionParent: "authored" },
  { overlap: "both", runtimeParent: "authored", distributionParent: "authored" },
])("fresh core rejects $overlap allocations inside authored source before spawning and releases both roots", async ({ runtimeParent: runtimeRelative, distributionParent: distributionRelative }) => {
  const parent = filesystem.create({ prefix: "fresh-core-admission-" });
  filesystem.write({ root: parent, relative: "authored/sentinel", text: "authored bytes\r\n" });
  const sourceRoot = filesystem.path({ root: parent, relative: "authored" });
  const runtimeParent = filesystem.path({ root: parent, relative: runtimeRelative });
  const distributionParent = filesystem.path({ root: parent, relative: distributionRelative });
  const runtimeDirectories = createChildRuntimeSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "runtime" }), temporaryParent: () => runtimeParent } });
  const distributionDirectories = createDistributionSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "distribution" }), temporaryParent: () => distributionParent } });
  const spawn = mock(async () => "unissued");
  const consume = mock<FreshCoreConsume>(async roots => {
    expect(filesystem.observe(roots.runtimeRoot).parent).toBe(runtimeParent);
    expect(filesystem.observe(roots.distributionRoot).parent).toBe(distributionParent);
    expect(filesystem.observe(roots.runtimeRoot).presence).toBe("present");
    expect(filesystem.observe(roots.distributionRoot).presence).toBe("present");
    admitFreshCoreDirectories({ sourceRoot, ...roots });
    return spawn();
  });
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume })).rejects.toThrow("Fresh core session roots must be separate from authored source and each other");
  expect(spawn).not.toHaveBeenCalled();
  expect(consume).toHaveBeenCalledTimes(1);
  const [roots] = consume.mock.calls[0]!;
  expect(roots.runtimeRoot).not.toBe(roots.distributionRoot);
  expect(filesystem.observe(roots.runtimeRoot).presence).toBe("absent");
  expect(filesystem.observe(roots.distributionRoot).presence).toBe("absent");
  expect(filesystem.read({ root: sourceRoot, relative: "sentinel" })).toBe("authored bytes\r\n");
  expect(filesystem.observe(parent).presence).toBe("present");
});

test.skipIf(process.platform !== "win32")("Windows case aliases cannot hide an allocated root inside authored source", async () => {
  const parent = filesystem.create({ prefix: "fresh-core-admission-" });
  filesystem.write({ root: parent, relative: "authored/sentinel", text: "authored bytes\r\n" });
  const sourceRoot = filesystem.path({ root: parent, relative: "authored" });
  const sourceAlias = filesystem.path({ root: parent, relative: "AUTHORED" });
  const runtimeDirectories = createChildRuntimeSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "runtime" }), temporaryParent: () => sourceRoot } });
  const distributionDirectories = createDistributionSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "distribution" }), temporaryParent: () => parent } });
  const spawn = mock(async () => "unissued");
  const consume = mock<FreshCoreConsume>(async roots => {
    expect(filesystem.observe(roots.runtimeRoot).parent).toBe(sourceRoot);
    expect(filesystem.observe(roots.distributionRoot).parent).toBe(parent);
    admitFreshCoreDirectories({ sourceRoot: sourceAlias, ...roots });
    return spawn();
  });
  expect(sourceAlias).not.toBe(sourceRoot);
  expect(filesystem.observe(sourceAlias).presence).toBe("present");
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume })).rejects.toThrow("Fresh core session roots must be separate from authored source and each other");
  expect(spawn).not.toHaveBeenCalled();
  expect(consume).toHaveBeenCalledTimes(1);
  const [roots] = consume.mock.calls[0]!;
  expect(filesystem.observe(roots.runtimeRoot).presence).toBe("absent");
  expect(filesystem.observe(roots.distributionRoot).presence).toBe("absent");
  expect(filesystem.read({ root: sourceRoot, relative: "sentinel" })).toBe("authored bytes\r\n");
});

test("fresh core rejects a storage allocator returning the same real root to both owners", async () => {
  const parent = filesystem.create({ prefix: "fresh-core-admission-" });
  filesystem.write({ root: parent, relative: "authored/sentinel", text: "authored bytes\r\n" });
  const sourceRoot = filesystem.path({ root: parent, relative: "authored" });
  const nativeStorage = createSessionDirectoryStorage({ purpose: "runtime" });
  const sharedRoot = nativeStorage.create(parent);
  filesystem.write({ root: sharedRoot, relative: "cache/owned", text: "session bytes" });
  const storage = { temporaryParent: () => parent, create: mock<(parent: string) => string>(() => sharedRoot), remove: mock(nativeStorage.remove) };
  const runtimeDirectories = createChildRuntimeSessionDirectories({ storage });
  const distributionDirectories = createDistributionSessionDirectories({ storage });
  const spawn = mock(async () => "unissued");
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume: async roots => {
    expect(roots.runtimeRoot).toBe(sharedRoot);
    expect(roots.distributionRoot).toBe(sharedRoot);
    expect(filesystem.observe(sharedRoot).presence).toBe("present");
    admitFreshCoreDirectories({ sourceRoot, ...roots });
    return spawn();
  } })).rejects.toThrow("Fresh core session roots must be separate from authored source and each other");
  expect(spawn).not.toHaveBeenCalled();
  expect(storage.create.mock.calls).toEqual([[parent], [parent]]);
  expect(storage.remove.mock.calls).toEqual([[sharedRoot], [sharedRoot]]);
  expect(filesystem.observe(sharedRoot).presence).toBe("absent");
  expect(() => runtimeDirectories.remove({ root: sharedRoot })).toThrow("Runtime cleanup requires a root allocated by this directory instance");
  expect(distributionDirectories.remove({ root: sharedRoot })).toEqual({ status: "foreign-root" });
  expect(filesystem.read({ root: sourceRoot, relative: "sentinel" })).toBe("authored bytes\r\n");
});

test("fresh core rejects a relative source before spawning and releases both allocated roots", async () => {
  const parent = filesystem.create({ prefix: "fresh-core-admission-" });
  filesystem.write({ root: parent, relative: "authored/sentinel", text: "authored bytes\r\n" });
  const runtimeDirectories = createChildRuntimeSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "runtime" }), temporaryParent: () => parent } });
  const distributionDirectories = createDistributionSessionDirectories({ storage: { ...createSessionDirectoryStorage({ purpose: "distribution" }), temporaryParent: () => parent } });
  const spawn = mock(async () => "unissued");
  const consume = mock<FreshCoreConsume>(async roots => {
    admitFreshCoreDirectories({ sourceRoot: "authored", ...roots });
    return spawn();
  });
  await expect(withFreshCoreDirectories({ runtimeDirectories, distributionDirectories, consume })).rejects.toThrow("Qualified source preparation requires explicit absolute paths");
  expect(spawn).not.toHaveBeenCalled();
  expect(consume).toHaveBeenCalledTimes(1);
  const [roots] = consume.mock.calls[0]!;
  expect(filesystem.observe(roots.runtimeRoot).presence).toBe("absent");
  expect(filesystem.observe(roots.distributionRoot).presence).toBe("absent");
  expect(filesystem.read({ root: parent, relative: "authored/sentinel" })).toBe("authored bytes\r\n");
});
