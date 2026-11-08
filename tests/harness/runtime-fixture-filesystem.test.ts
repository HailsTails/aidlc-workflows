import { afterEach, expect, test } from "bun:test";
import { createRuntimeFixtureFilesystem } from "./runtime-fixture-filesystem.ts";

const filesystem = createRuntimeFixtureFilesystem();
const other = createRuntimeFixtureFilesystem();
afterEach(filesystem.cleanup);
afterEach(other.cleanup);

test("runtime fixture storage preserves literal nested text and line endings", () => {
  const root = filesystem.create({ prefix: "runtime-storage-" });
  filesystem.write({ root, relative: "nested/value.txt", text: "exact\r\nUnicode: \u03bb\n" });
  expect(filesystem.read({ root, relative: "nested/value.txt" })).toBe("exact\r\nUnicode: \u03bb\n");
  expect(filesystem.observe(root).parent).toBe(filesystem.temporaryRoot);
});

test("runtime fixture cleanup cannot remove a different owner and retains its bytes", () => {
  const first = filesystem.create({ prefix: "runtime-storage-" });
  const second = other.create({ prefix: "runtime-storage-" });
  other.write({ root: second, relative: "value.txt", text: "second owner" });
  expect(() => filesystem.remove({ root: second })).toThrow("allocated root");
  filesystem.remove({ root: first });
  expect((filesystem.observe(first).presence === "present")).toBe(false);
  expect(other.read({ root: second, relative: "value.txt" })).toBe("second owner");
});

test("runtime fixture operations refuse escaping and absolute relative paths", () => {
  const root = filesystem.create({ prefix: "runtime-storage-" });
  const target = other.create({ prefix: "runtime-storage-" });
  expect(() => filesystem.write({ root, relative: "../outside.txt", text: "refused" })).toThrow("inside the requested root");
  expect(() => filesystem.path({ root, relative: target })).toThrow("inside the requested root");
  expect(() => filesystem.read({ root: target, relative: "value.txt" })).toThrow("live owned root");
});

test("released fixture roots cannot be reused by file operations", () => {
  const root = filesystem.create({ prefix: "runtime-storage-" });
  filesystem.remove({ root });
  expect(() => filesystem.write({ root, relative: "value.txt", text: "refused" })).toThrow("live owned root");
  filesystem.remove({ root });
  expect((filesystem.observe(root).presence === "present")).toBe(false);
});

test("partial source materialization cleans its real temporary directory", () => {
  const before = filesystem.temporaryEntries("runtime-partial-");
  expect(() => filesystem.create({ prefix: "runtime-partial-", sources: ["package.json", "absent-runtime-fixture-input"] })).toThrow("ENOENT");
  expect(filesystem.temporaryEntries("runtime-partial-")).toEqual(before);
});

test("source copying rejects escape and empty whole-repository selection", () => {
  const before = filesystem.temporaryEntries("runtime-partial-");
  expect(() => filesystem.create({ prefix: "runtime-partial-", sources: ["../outside"] })).toThrow("inside the requested root");
  expect(() => filesystem.create({ prefix: "runtime-partial-", sources: [""] })).toThrow("named repository entries");
  expect(filesystem.temporaryEntries("runtime-partial-")).toEqual(before);
});

test("dependency links cannot authorize paths through linked ancestors", () => {
  const root = filesystem.create({ prefix: "runtime-storage-", dependencies: "repository-link" });
  expect(() => filesystem.path({ root, relative: "node_modules" })).toThrow("linked paths");
  expect(() => filesystem.path({ root: `${root}/node_modules/typescript`, relative: "package.json" })).toThrow("linked paths");
});

test("invalid fixture prefixes cannot allocate outside the temp parent", () => {
  expect(() => filesystem.create({ prefix: "../escape-" })).toThrow("simple directory names");
});

// Lexical placement is an observation only; it grants no filesystem ownership.
test("runtime fixture placement distinguishes deep descendants, siblings and equal roots", () => {
  const root = filesystem.create({ prefix: "runtime-storage-" });
  const sibling = other.create({ prefix: "runtime-storage-" });
  filesystem.write({ root, relative: "nested/deep/value.txt", text: "owned" });
  const descendant = filesystem.path({ root, relative: "nested/deep/value.txt" });
  expect(filesystem.relationship({ root, target: root })).toBe("same");
  expect(filesystem.relationship({ root, target: descendant })).toBe("inside");
  expect(filesystem.relationship({ root, target: sibling })).toBe("outside");
  expect(filesystem.relationship({ root, target: filesystem.temporaryRoot })).toBe("outside");
  expect(filesystem.relationship({ root, target: root + "-lookalike" })).toBe("outside");
  expect(() => filesystem.read({ root: sibling, relative: "value.txt" })).toThrow("live owned root");
  expect(filesystem.read({ root, relative: "nested/deep/value.txt" })).toBe("owned");
});
