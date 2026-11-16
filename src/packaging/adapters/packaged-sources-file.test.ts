import { expect, mock, test } from "bun:test";
import { z } from "zod";
import type { FileContent } from "../../kernel/file-content.ts";
import { createInMemoryFileSystem, type InMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { distribution } from "../../kernel/fixtures/values.fixture.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { contentHash } from "../../kernel/values.ts";
import { sha256Bytes } from "./legacy-distribution.ts";
import { createPackagedSourcesFile } from "./packaged-sources-file.ts";

const LEGACY_HEX = "8039344a52f1f7057d99dd83bf0e73640fe73269924ac3dc7e5d69fe05cf3b22";
const repository = new URL("file:///repo/");
const recordFile = new URL("file:///repo/dist/.package-sources.json");
const byteStream = z.object({ kind: z.literal("bytes"), bytes: z.instanceof(Uint8Array) });
const hasher = { hash: (content: FileContent) =>
  contentHash(sha256Bytes(Buffer.from(byteStream.parse(content).bytes))) };
const sourceTree = () => createInMemoryFileSystem({ files: {
  "file:///repo/core/a.bin": new Uint8Array([0, 255, 10]), "file:///repo/harness/z.md": "# z\n",
} });
const sourcesFor = (fileSystem: InMemoryFileSystem) =>
  createPackagedSourcesFile({ repository, record: recordFile, fileSystem, hasher });

test("hashes the legacy sorted path NUL raw-bytes NUL stream once and returns bare hex", async () => {
  const hashContent = mock(hasher.hash);
  const sources = createPackagedSourcesFile({ repository, record: recordFile,
    fileSystem: sourceTree(), hasher: { hash: hashContent } });
  expect(await sources.fingerprint()).toEqual(accepted(LEGACY_HEX));
  expect(hashContent).toHaveBeenCalledTimes(1);
  expect(hashContent).toHaveBeenCalledWith({ kind: "bytes", bytes: new Uint8Array([
    99,111,114,101,47,97,46,98,105,110,0,0,255,10,0,
    104,97,114,110,101,115,115,47,122,46,109,100,0,35,32,122,10,0,
  ]) });
});

test("fingerprints repeat and return to the original after a source edit is undone", async () => {
  const fileSystem = sourceTree();
  const sources = sourcesFor(fileSystem);
  expect(await sources.fingerprint()).toEqual(accepted(LEGACY_HEX));
  expect(await sources.fingerprint()).toEqual(accepted(LEGACY_HEX));
  await fileSystem.writeFile({ file: new URL("file:///repo/harness/z.md"), content: { kind: "text", text: "changed" } });
  expect(await sources.fingerprint()).not.toEqual(accepted(LEGACY_HEX));
  await fileSystem.writeFile({ file: new URL("file:///repo/harness/z.md"), content: { kind: "text", text: "# z\n" } });
  expect(await sources.fingerprint()).toEqual(accepted(LEGACY_HEX));
});

test.each(["harness/claude/manifest.ts", "plugins/demo/stages/s.md", "scripts/package.ts",
  "scripts/package-sources.ts", "src/workflow-definition/domain/example.ts", "scripts/plugin-hooks-template/compose.ts"])(
  "retains the old input-edit assertion for %s when present", async (path) => {
    const fileSystem = sourceTree();
    const sources = sourcesFor(fileSystem);
    await fileSystem.writeFile({ file: new URL(path, repository), content: { kind: "text", text: "original\n" } });
    const before = await sources.fingerprint();
    await fileSystem.writeFile({ file: new URL(path, repository), content: { kind: "text", text: "changed\n" } });
    expect(await sources.fingerprint()).not.toEqual(before);
    await fileSystem.writeFile({ file: new URL(path, repository), content: { kind: "text", text: "original\n" } });
    expect(await sources.fingerprint()).toEqual(before);
  });

test.each([
  "plugins/demo/stages/s.md", "src/workflow-definition/domain/example.ts", "scripts/package.ts",
  "scripts/package-sources.ts", "scripts/agent-knowledge.ts", "scripts/copy-era-files.json",
  "scripts/plugin-hooks-template/compose.ts",
])("includes the packaged input %s", async (path) => {
  const fileSystem = sourceTree();
  const sources = sourcesFor(fileSystem);
  await fileSystem.writeFile({ file: new URL(path, repository), content: { kind: "text", text: "new input" } });
  expect(await sources.fingerprint()).not.toEqual(accepted(LEGACY_HEX));
});

test.each([
  "plugins/demo/tests/t.test.ts", "src/workflow-definition/domain/example.test.ts",
  "src/workflow-definition/domain/example.spec.ts", "src/workflow-definition/fixtures/example.fixture.ts",
  "src/workflow-definition/tests/helper.ts", "core/node_modules/dep/index.js", "scripts/ci-other.ts", "tests/t1.test.ts",
])("ignores the unpackaged input %s", async (path) => {
  const fileSystem = sourceTree();
  const sources = sourcesFor(fileSystem);
  await fileSystem.writeFile({ file: new URL(path, repository), content: { kind: "text", text: "ignored" } });
  expect(await sources.fingerprint()).toEqual(accepted(LEGACY_HEX));
});

test("records sorted host entries with the exact legacy descriptor and newline", async () => {
  const fileSystem = sourceTree();
  const sources = sourcesFor(fileSystem);
  expect(await sources.record({ hosts: [distribution("kiro"), distribution("claude")], builtFrom: LEGACY_HEX }))
    .toEqual(accepted("recorded"));
  expect(await fileSystem.readFile({ file: recordFile })).toEqual(accepted({ kind: "text", text:
    '{\n  "schemaVersion": 1,\n  "harnesses": {\n    "claude": "8039344a52f1f7057d99dd83bf0e73640fe73269924ac3dc7e5d69fe05cf3b22",\n    "kiro": "8039344a52f1f7057d99dd83bf0e73640fe73269924ac3dc7e5d69fe05cf3b22"\n  }\n}\n' }));
  expect(await sources.staleness(distribution("claude"))).toEqual(accepted(null));
  expect(await sources.staleness(distribution("kiro"))).toEqual(accepted(null));
});

test("a source change gives the unchanged stale-host message", async () => {
  const fileSystem = sourceTree();
  const sources = sourcesFor(fileSystem);
  await sources.record({ hosts: [distribution("claude")], builtFrom: LEGACY_HEX });
  await fileSystem.writeFile({ file: new URL("file:///repo/core/a.bin"), content: { kind: "bytes", bytes: new Uint8Array([1]) } });
  expect(await sources.staleness(distribution("claude"))).toEqual(accepted(
    "dist/claude was packaged from other sources than this checkout: run `bun scripts/package.ts` first."));
});

test("a one-host build updates its own entry and preserves another host's old record", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///repo/core/a.bin": new Uint8Array([0, 255, 10]), "file:///repo/harness/z.md": "# z\n",
    "file:///repo/dist/.package-sources.json": '{"schemaVersion":1,"harnesses":{"claude":"old","kiro":"old"}}',
  } });
  const sources = sourcesFor(fileSystem);
  expect(await sources.record({ hosts: [distribution("kiro")], builtFrom: LEGACY_HEX })).toEqual(accepted("recorded"));
  expect(await sources.staleness(distribution("kiro"))).toEqual(accepted(null));
  expect(await sources.staleness(distribution("claude"))).toEqual(accepted(
    "dist/claude was packaged from other sources than this checkout: run `bun scripts/package.ts` first."));
  expect(await fileSystem.readFile({ file: recordFile })).toEqual(accepted({ kind: "text", text:
    '{\n  "schemaVersion": 1,\n  "harnesses": {\n    "claude": "old",\n    "kiro": "8039344a52f1f7057d99dd83bf0e73640fe73269924ac3dc7e5d69fe05cf3b22"\n  }\n}\n' }));
});

test("a mid-build edit leaves the forgotten host unrecorded without rewriting the record", async () => {
  const fileSystem = sourceTree();
  const sources = sourcesFor(fileSystem);
  await sources.record({ hosts: [distribution("claude"), distribution("kiro")], builtFrom: LEGACY_HEX });
  expect(await sources.forget([distribution("claude")])).toEqual(accepted(undefined));
  await fileSystem.writeFile({ file: new URL("file:///repo/harness/z.md"), content: { kind: "text", text: "edited" } });
  expect(await sources.record({ hosts: [distribution("claude")], builtFrom: LEGACY_HEX })).toEqual(accepted("inputs-changed"));
  expect(await sources.staleness(distribution("claude"))).toEqual(accepted(
    "dist/claude has no record of the sources it was packaged from: run `bun scripts/package.ts` first."));
  expect(await fileSystem.readFile({ file: recordFile })).toEqual(accepted({ kind: "text", text:
    '{\n  "schemaVersion": 1,\n  "harnesses": {\n    "kiro": "8039344a52f1f7057d99dd83bf0e73640fe73269924ac3dc7e5d69fe05cf3b22"\n  }\n}\n' }));
});

test("an interrupted build forgets only its host", async () => {
  const fileSystem = sourceTree();
  const sources = sourcesFor(fileSystem);
  await sources.record({ hosts: [distribution("claude"), distribution("kiro")], builtFrom: LEGACY_HEX });
  await sources.forget([distribution("claude")]);
  expect(await sources.staleness(distribution("claude"))).toEqual(accepted(
    "dist/claude has no record of the sources it was packaged from: run `bun scripts/package.ts` first."));
  expect(await sources.staleness(distribution("kiro"))).toEqual(accepted(null));
});

test("forgetting an absent record does not create it", async () => {
  const fileSystem = sourceTree();
  expect(await sourcesFor(fileSystem).forget([distribution("claude")])).toEqual(accepted(undefined));
  expect(await fileSystem.readFile({ file: recordFile })).toEqual(refused({ kind: "unreadable", code: "not-found" }));
});

test.each(["{", "null", "[]", "{}", "\uFEFF{}", '{"harnesses":[]}', '{"harnesses":{"claude":3,"kiro":"old"}}'])
("malformed record %s gives the legacy missing-record message", async (text) => {
  const fileSystem = createInMemoryFileSystem({ files: { "file:///repo/dist/.package-sources.json": text } });
  expect(await sourcesFor(fileSystem).staleness(distribution("claude"))).toEqual(accepted(
    "dist/claude has no record of the sources it was packaged from: run `bun scripts/package.ts` first."));
});

test("a malformed record is replaced and non-string entries are dropped on recording", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///repo/core/a.bin": new Uint8Array([0, 255, 10]), "file:///repo/harness/z.md": "# z\n",
    "file:///repo/dist/.package-sources.json": '{"harnesses":{"claude":3,"kiro":"old"}}',
  } });
  expect(await sourcesFor(fileSystem).record({ hosts: [distribution("claude")], builtFrom: LEGACY_HEX }))
    .toEqual(accepted("recorded"));
  expect(await fileSystem.readFile({ file: recordFile })).toEqual(accepted({ kind: "text", text:
    '{\n  "schemaVersion": 1,\n  "harnesses": {\n    "claude": "8039344a52f1f7057d99dd83bf0e73640fe73269924ac3dc7e5d69fe05cf3b22",\n    "kiro": "old"\n  }\n}\n' }));
});

test("an unreadable record retains the legacy empty-record outcome", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: {
    "file:///repo/dist/.package-sources.json": "permission-denied",
  } });
  expect(await sourcesFor(fileSystem).staleness(distribution("claude"))).toEqual(accepted(
    "dist/claude has no record of the sources it was packaged from: run `bun scripts/package.ts` first."));
});

test("input tree failures name the actual source and are refusal data", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: { "file:///repo/core/": "permission-denied" } });
  expect(await sourcesFor(fileSystem).fingerprint()).toEqual(refused({ kind: "packaged-sources-failed",
    operation: "read-inputs", path: "file:///repo/core/", reason: "permission-denied" }));
});

test("nested input failures are not silently omitted", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: { "file:///repo/core/a.md": "permission-denied" } });
  expect(await sourcesFor(fileSystem).fingerprint()).toEqual(refused({ kind: "packaged-sources-failed",
    operation: "read-inputs", path: "core/a.md", reason: "permission-denied" }));
});

test("an explicit input file failure keeps its actual path", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: { "file:///repo/scripts/package.ts": "not-a-file" } });
  expect(await sourcesFor(fileSystem).fingerprint()).toEqual(refused({ kind: "packaged-sources-failed",
    operation: "read-inputs", path: "scripts/package.ts", reason: "not-a-file" }));
});

test("hasher refusals cannot be accepted as a fingerprint", async () => {
  const sources = createPackagedSourcesFile({ repository, record: recordFile, fileSystem: sourceTree(),
    hasher: { hash: () => refused({ kind: "invalid-content-hash", raw: "bad" }) } });
  expect(await sources.fingerprint()).toEqual(refused({ kind: "packaged-sources-failed",
    operation: "hash-inputs", path: "file:///repo/", reason: "invalid-content-hash" }));
});

test("a refused write never reports a successful record", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///repo/core/a.bin": new Uint8Array([0, 255, 10]), "file:///repo/harness/z.md": "# z\n",
  }, faults: { "file:///repo/dist/.package-sources.json": "permission-denied" } });
  expect(await sourcesFor(fileSystem).record({ hosts: [distribution("claude")], builtFrom: LEGACY_HEX }))
    .toEqual(refused({ kind: "packaged-sources-failed", operation: "write-record",
      path: "file:///repo/dist/.package-sources.json", reason: "permission-denied" }));
});

test("forget reports the write refusal for an existing unreadable record", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: {
    "file:///repo/dist/.package-sources.json": "permission-denied",
  } });
  expect(await sourcesFor(fileSystem).forget([distribution("claude")])).toEqual(refused({ kind: "packaged-sources-failed",
    operation: "write-record", path: "file:///repo/dist/.package-sources.json", reason: "permission-denied" }));
});
