// covers: function:compareInstalledRuntimeFiles

import { expect, test } from "bun:test";
import { compareInstalledRuntimeFiles } from "./aidlc-runtime-inventory.ts";

const FIRST = Object.freeze({ path: "claude/tools/aidlc.ts", mode: 0o644, sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
const SECOND = Object.freeze({ path: "claude/tools/data/harness.json", mode: 0o600, sha256: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });

test("empty inventories match", () => {
  expect(compareInstalledRuntimeFiles({ expectedFiles: [], actualFiles: [] })).toBeNull();
});

test("matching frozen evidence stays unchanged", () => {
  const files = Object.freeze([FIRST, SECOND]);
  expect(compareInstalledRuntimeFiles({ expectedFiles: files, actualFiles: files })).toBeNull();
  expect(files).toEqual([FIRST, SECOND]);
});

test.each([
  { expectedFiles: [], actualFiles: [FIRST] },
  { expectedFiles: [FIRST], actualFiles: [] },
  { expectedFiles: [null, SECOND], actualFiles: [FIRST] },
])("count mismatch precedes entry validation: %s", ({ expectedFiles, actualFiles }) => {
  expect(compareInstalledRuntimeFiles({ expectedFiles, actualFiles })).toBe("runtime file inventory does not match the installed baseline");
});

test.each([
  { entry: null }, { entry: false }, { entry: 0 }, { entry: true }, { entry: "file" }, { entry: [] }, { entry: {} },
  { entry: { mode: 420, sha256: FIRST.sha256 } },
  { entry: { path: 1, mode: 420, sha256: FIRST.sha256 } },
  { entry: { path: FIRST.path, sha256: FIRST.sha256 } },
  { entry: { path: FIRST.path, mode: "420", sha256: FIRST.sha256 } },
  { entry: { path: FIRST.path, mode: 1.5, sha256: FIRST.sha256 } },
  { entry: { path: FIRST.path, mode: Number.NaN, sha256: FIRST.sha256 } },
  { entry: { path: FIRST.path, mode: Number.POSITIVE_INFINITY, sha256: FIRST.sha256 } },
  { entry: { path: FIRST.path, mode: 420 } },
  { entry: { path: FIRST.path, mode: 420, sha256: 1 } },
  { entry: { path: FIRST.path, mode: 420, sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { entry: { path: FIRST.path, mode: 420, sha256: "SHA256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
  { entry: { path: FIRST.path, mode: 420, sha256: "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } },
  { entry: { path: FIRST.path, mode: 420, sha256: "sha256:abc" } },
])("malformed baseline entry is refused: %s", ({ entry }) => {
  expect(compareInstalledRuntimeFiles({ expectedFiles: [entry], actualFiles: [FIRST] })).toBe("runtime integrity baseline contains an invalid file entry");
});

test("reordered files are an inventory mismatch", () => {
  expect(compareInstalledRuntimeFiles({ expectedFiles: [SECOND, FIRST], actualFiles: [FIRST, SECOND] })).toBe("runtime file inventory does not match the installed baseline");
});

test("path mismatch precedes content mismatch", () => {
  expect(compareInstalledRuntimeFiles({ expectedFiles: [SECOND], actualFiles: [FIRST] })).toBe("runtime file inventory does not match the installed baseline");
});

test.each([
  { expected: { path: FIRST.path, mode: 0, sha256: FIRST.sha256 } },
  { expected: { path: FIRST.path, mode: -1, sha256: FIRST.sha256 } },
  { expected: { path: FIRST.path, mode: 0o100644, sha256: FIRST.sha256 } },
  { expected: { path: FIRST.path, mode: FIRST.mode, sha256: SECOND.sha256 } },
])("mode or content change identifies the affected file: %s", ({ expected }) => {
  expect(compareInstalledRuntimeFiles({ expectedFiles: [expected], actualFiles: [FIRST] })).toBe("runtime file claude/tools/aidlc.ts does not match the installed baseline");
});

test("an early file change precedes a later malformed entry", () => {
  expect(compareInstalledRuntimeFiles({ expectedFiles: [{ path: FIRST.path, mode: 0, sha256: FIRST.sha256 }, null], actualFiles: [FIRST, SECOND] })).toBe("runtime file claude/tools/aidlc.ts does not match the installed baseline");
});

test("comparison retains duplicate and empty path evidence without new path policy", () => {
  expect(compareInstalledRuntimeFiles({ expectedFiles: [FIRST, FIRST], actualFiles: [FIRST, FIRST] })).toBeNull();
  expect(compareInstalledRuntimeFiles({ expectedFiles: [{ path: "", mode: 0, sha256: FIRST.sha256 }], actualFiles: [{ path: "", mode: 0, sha256: FIRST.sha256 }] })).toBeNull();
});
