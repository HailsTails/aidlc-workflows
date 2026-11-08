import "../../../harness/runtime-fixture-filesystem.test.ts";
import { afterEach, expect, test } from "bun:test";
import { createAllocationFailureStorageFixture, createCleanupFailureStorageFixture, createRuntimeDirectoryFixtures, readRuntimeValue, removeRuntimeDirectoryFixture, runtimeDirectoryExists, writeRuntimeValue } from "./child-runtime-fixture.ts";

const fixtures = createRuntimeDirectoryFixtures();
afterEach(fixtures.cleanup);

test("runtime value fixture preserves exact cache bytes", () => {
  const root = fixtures.create();
  writeRuntimeValue({ root, text: "exact\r\nvalue" });
  expect(readRuntimeValue(root)).toBe("exact\r\nvalue");
});
test("runtime fixture disposal removes the owned parent", () => {
  const root = fixtures.create();
  expect(runtimeDirectoryExists(root)).toBe(true);
  removeRuntimeDirectoryFixture(root);
  expect(runtimeDirectoryExists(root)).toBe(false);
});
test("allocation failure fixture never records a successful removal", () => {
  const fixture = createAllocationFailureStorageFixture();
  expect(fixture.storage.create).toThrow("allocation failed");
  expect(fixture.removed).toEqual([]);
});
test("cleanup failure fixture records only successful retry", () => {
  const fixture = createCleanupFailureStorageFixture();
  const owned = fixture.storage.create("caller-temp");
  expect(() => fixture.storage.remove(owned)).toThrow("cleanup failed");
  expect(fixture.removed).toEqual([]);
  fixture.recover();
  fixture.storage.remove(owned);
  expect(fixture.removed).toEqual(["caller-temp/owned"]);
});
