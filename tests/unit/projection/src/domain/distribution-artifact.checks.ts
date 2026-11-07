import { expect, mock, test } from "bun:test";
import { distributionMetadataPaths, distributionDirectoryFindings } from "../../../../../scripts/projection/src/domain/distribution-artifact.ts";
test("distribution identity files use the actual engine root", () => {
  expect(distributionMetadataPaths({ binding: { harness: "codex", directory: ".codex" } })).toEqual([".codex/tools/data/aidlc-projection.json", ".codex/tools/data/aidlc-stamp.json", ".codex/tools/data/harness.json"]);
});
test("empty directories are valid retained artifact inputs", () => {
  expect(distributionDirectoryFindings({ directories: [{ path: ".codex/skills", mode: 0o755 }], files: [], path: mock().mockReturnValue("safe") })).toEqual([]);
});
test("duplicate directories cannot become duplicate native archive entries", () => {
  expect(distributionDirectoryFindings({ directories: [{ path: ".codex/skills", mode: 0o755 }, { path: ".codex/skills", mode: 0o755 }], files: [], path: mock().mockReturnValue("safe") })).toEqual([{ code: "destination-collision", subject: ".codex/skills", detail: "distribution directories must be unique and cannot occupy native file paths" }]);
});
test("a directory cannot occupy a native file's path", () => {
  expect(distributionDirectoryFindings({ directories: [{ path: ".codex/skills", mode: 0o755 }], files: [{ path: ".codex/skills", bytes: new Uint8Array([1]), mode: 0o644 }], path: mock().mockReturnValue("safe") })).toEqual([{ code: "destination-collision", subject: ".codex/skills", detail: "distribution directories must be unique and cannot occupy native file paths" }]);
});
test("directory safety and permission refusals remain explicit", () => {
  expect(distributionDirectoryFindings({ directories: [{ path: "../outside", mode: -1 }], files: [], path: mock().mockReturnValue("unsafe") })).toEqual([{ code: "invalid-destination", subject: "../outside", detail: "distribution directories require safe relative paths" }, { code: "invalid-input", subject: "../outside", detail: "distribution directories require permission modes between 0 and 0777" }]);
});
test("harnesses sharing an engine root share metadata destinations", () => {
  expect(distributionMetadataPaths({ binding: { harness: "opencode", directory: ".aidlc" } })).toEqual([".aidlc/tools/data/aidlc-projection.json", ".aidlc/tools/data/aidlc-stamp.json", ".aidlc/tools/data/harness.json"]);
  expect(distributionMetadataPaths({ binding: { harness: "copilot", directory: ".aidlc" } })).toEqual([".aidlc/tools/data/aidlc-projection.json", ".aidlc/tools/data/aidlc-stamp.json", ".aidlc/tools/data/harness.json"]);
});
