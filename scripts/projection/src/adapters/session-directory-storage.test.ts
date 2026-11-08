import { afterEach, expect, test } from "bun:test";
import { createRuntimeFixtureFilesystem } from "../../../../tests/harness/runtime-fixture-filesystem.ts";
import { createSessionDirectoryStorage } from "./session-directory-storage.ts";

const filesystem = createRuntimeFixtureFilesystem();
afterEach(filesystem.cleanup);

test("native session storage integration discovers the caller temporary parent", () => {
  const runtime = createSessionDirectoryStorage({ purpose: "runtime" });
  const distribution = createSessionDirectoryStorage({ purpose: "distribution" });
  expect(runtime.temporaryParent()).toBe(filesystem.temporaryRoot);
  expect(distribution.temporaryParent()).toBe(filesystem.temporaryRoot);
});

test("native session storage integration keeps distinct shallow prefixes and removes nested contents", () => {
  const parent = filesystem.create({ prefix: "session-storage-test-" });
  const runtime = createSessionDirectoryStorage({ purpose: "runtime" });
  const distribution = createSessionDirectoryStorage({ purpose: "distribution" });
  const runtimeRoot = runtime.create(parent);
  const distributionRoot = distribution.create(parent);
  const siblingRoot = distribution.create(parent);
  expect(filesystem.observe(runtimeRoot).parent).toBe(parent);
  expect(filesystem.observe(distributionRoot).parent).toBe(parent);
  expect(filesystem.observe(siblingRoot).parent).toBe(parent);
  expect(runtimeRoot).toMatch(/[\\/]aidlc-runtime-[^\\/]+$/);
  expect(distributionRoot).toMatch(/[\\/]aidlc-distribution-[^\\/]+$/);
  expect(distributionRoot).not.toBe(siblingRoot);
  filesystem.write({ root: distributionRoot, relative: "nested/content", text: "private" });
  filesystem.write({ root: siblingRoot, relative: "sibling", text: "retained" });
  distribution.remove(distributionRoot);
  expect(filesystem.observe(distributionRoot).presence).toBe("absent");
  expect(filesystem.read({ root: siblingRoot, relative: "sibling" })).toBe("retained");
  expect(filesystem.observe(runtimeRoot).presence).toBe("present");
  distribution.remove(siblingRoot);
  runtime.remove(runtimeRoot);
  expect(filesystem.observe(parent).presence).toBe("present");
});

test("native session storage integration reports an unavailable parent without creating it", () => {
  const parent = filesystem.create({ prefix: "session-storage-test-" });
  const unavailable = filesystem.path({ root: parent, relative: "missing" });
  const storage = createSessionDirectoryStorage({ purpose: "distribution" });
  expect(() => storage.create(unavailable)).toThrow();
  expect(filesystem.observe(unavailable).presence).toBe("absent");
});
