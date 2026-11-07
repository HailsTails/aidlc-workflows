// covers: file:tests/unit/t-projection-delivery-fixtures.ts
import { expect, test } from "bun:test";
import cursor from "../../harness/cursor/manifest.ts";
import { ordinaryCursorResources, flaggedCursorResources, cursorWithoutReplacements, rootIntegrationPaths, copyDescriptionFiles, createForbiddenDescriptionSpawn, readPreparedDescriptor, requireSuccessfulOutcome } from "./t-projection-delivery-fixtures.ts";

test("Cursor fixture projections retain ordinary resources without mutating the declaration", () => {
  expect(ordinaryCursorResources).toHaveLength(16);
  expect(ordinaryCursorResources).toContainEqual({ src: "skills/aidlc/SKILL.md", dst: "skills/aidlc/SKILL.md" });
  expect(ordinaryCursorResources).not.toContainEqual({ src: "install.ts", dst: "install.ts", projectRoot: true, copyOnly: true });
  expect(flaggedCursorResources).toHaveLength(17);
  expect(flaggedCursorResources[0]).toEqual({ src: "skills/aidlc/SKILL.md", dst: "skills/aidlc/SKILL.md", copyOnly: true });
  expect(cursor.harnessFiles[0]).toEqual({ src: "skills/aidlc/SKILL.md", dst: "skills/aidlc/SKILL.md" });
  expect(cursor.harnessFiles[16]).toEqual({ src: "install.ts", dst: "install.ts", projectRoot: true, copyOnly: true });
  expect(cursorWithoutReplacements).not.toHaveProperty("nativeReplacements");
  expect(cursor.nativeReplacements).toEqual([{ from: "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),", to: "run `aidlc doctor`," }]);
});

test("root path observation preserves order and duplicates", () => {
  expect(rootIntegrationPaths({ ...cursor, rootIntegrations: [{ path: "second", policy: "whole-file" }, { path: "first", policy: "whole-file" }, { path: "second", policy: "whole-file" }] })).toEqual(["second", "first", "second"]);
});

test("copy fixture encoding preserves paths and duplicates without qualifying them", () => {
  expect(copyDescriptionFiles(["../bad", "same", "same"])).toEqual([
    { path: "../bad", bytes: Buffer.from("copy"), mode: 0o644 },
    { path: "same", bytes: Buffer.from("copy"), mode: 0o644 },
    { path: "same", bytes: Buffer.from("copy"), mode: 0o644 },
  ]);
  expect(copyDescriptionFiles([])).toEqual([]);
});

test("forbidden process capability records calls and throws the intended error", () => {
  const spawn = createForbiddenDescriptionSpawn();
  expect(spawn).not.toHaveBeenCalled();
  expect(spawn).toThrow("must not spawn");
  expect(spawn).toHaveBeenCalledTimes(1);
});

test("descriptor observation decodes the actual first artifact without rewriting fields", () => {
  expect(readPreparedDescriptor({ kind: "prepared", artifacts: [{ file: "descriptor", bytes: Buffer.from('{"legacyManagedFileHashes":{"keep":["old","old"]},"other":19}') }] })).toEqual({ legacyManagedFileHashes: { keep: ["old", "old"] }, other: 19 });
});

test.each([
  { kind: "refused" as const, message: "no artifact" },
  { kind: "prepared" as const, artifacts: [] },
])("descriptor observation rejects missing successful artifacts: %j", preparation => {
  expect(() => readPreparedDescriptor(preparation)).toThrow();
});

test.each(["null", "[]", "19", "malformed"])("descriptor observation refuses a non-object or malformed JSON: %s", text => {
  expect(() => readPreparedDescriptor({ kind: "prepared", artifacts: [{ file: "descriptor", bytes: Buffer.from(text) }] })).toThrow();
});

test("successful outcome observation preserves identity and refuses failed preparation", () => {
  const prepared = { policy: "authored" };
  expect(requireSuccessfulOutcome({ status: "ok", value: prepared })).toBe(prepared);
  expect(() => requireSuccessfulOutcome({ status: "invalid", findings: [{ code: "invalid-input", subject: "fixture", detail: "bad input" }] })).toThrow("fixture observation requires a successful outcome");
});
