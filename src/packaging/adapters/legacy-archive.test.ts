import { expect, mock, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { hash } from "../../kernel/fixtures/values.fixture.ts";
import type { ArchiveEntry } from "../domain/artifact.ts";
import { createLegacyArtifactWriter } from "./legacy-archive.ts";

const digest = hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const folder = new URL("file:///archives/");
const hasher = { hash: () => accepted(digest) };

test("the registered formatter receives exact regular/executable modes and binary bytes", async () => {
  const encode = mock(() => Buffer.from([31, 139, 8]));
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const hashContent = mock(hasher.hash);
  expect(await createLegacyArtifactWriter({ folder, fileSystem, hasher: { hash: hashContent } }, encode).write({
    name: "runtime #.tar.gz", format: "tar.gz", files: [{
      entry: brand<ArchiveEntry>("runtime/claude/a.txt"), content: { kind: "text", text: "plain" }, mode: "regular",
    }, { entry: brand<ArchiveEntry>("runtime/claude/b.bin"),
      content: { kind: "bytes", bytes: new Uint8Array([0, 255]) }, mode: "executable" }],
  })).toEqual(accepted(digest));
  expect(encode).toHaveBeenCalledWith([
    { path: "runtime/claude/a.txt", type: "file", mode: 0o644, data: Buffer.from("plain") },
    { path: "runtime/claude/b.bin", type: "file", mode: 0o755, data: Buffer.from([0, 255]) },
  ]);
  expect(hashContent).toHaveBeenCalledTimes(1);
  expect(hashContent).toHaveBeenCalledWith({ kind: "bytes", bytes: Buffer.from([31, 139, 8]) });
  expect(await fileSystem.readFile({ file: new URL("file:///archives/runtime%20%23.tar.gz") }))
    .toEqual(accepted({ kind: "bytes", bytes: Buffer.from([31, 139, 8]) }));
  expect(fileSystem.modes()).toEqual({ "file:///archives/runtime%20%23.tar.gz": "regular" });
});

test("the default formatter builds archive bytes without another filesystem owner", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const hashContent = mock(hasher.hash);
  expect(await createLegacyArtifactWriter({ folder, fileSystem, hasher: { hash: hashContent } }).write({
    name: "empty.tar.gz", format: "tar.gz", files: [],
  })).toEqual(accepted(digest));
  expect(hashContent).toHaveBeenCalledWith({ kind: "bytes", bytes: expect.any(Uint8Array) });
});

test("unsafe archive destinations refuse before encoding or writing", async () => {
  const encode = mock(() => Buffer.from([]));
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const writeFile = mock(fileSystem.writeFile);
  expect(await createLegacyArtifactWriter({ folder, fileSystem: { ...fileSystem, writeFile }, hasher }, encode)
    .write({ name: "../outside.tar.gz", format: "tar.gz", files: [] })).toEqual(refused({
    kind: "archive-not-written", name: "../outside.tar.gz", reason: "The archive name must be a portable project-relative path.",
  }));
  expect(encode).not.toHaveBeenCalled();
  expect(writeFile).not.toHaveBeenCalled();
});

test("formatter failures return data before any archive is written", async () => {
  const encode = mock(() => accept<Buffer, string>(refused("encoding failed")));
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const writeFile = mock(fileSystem.writeFile);
  expect(await createLegacyArtifactWriter({ folder, fileSystem: { ...fileSystem, writeFile }, hasher }, encode)
    .write({ name: "runtime.tar.gz", format: "tar.gz", files: [] })).toEqual(refused({
    kind: "archive-not-written", name: "runtime.tar.gz", reason: 'Fixture value refused: "encoding failed"',
  }));
  expect(writeFile).not.toHaveBeenCalled();
});

test("hash failures return data before any archive is written", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const writeFile = mock(fileSystem.writeFile);
  expect(await createLegacyArtifactWriter({ folder, fileSystem: { ...fileSystem, writeFile },
    hasher: { hash: () => refused({ kind: "invalid-content-hash", raw: "bad" }) } })
    .write({ name: "runtime.tar.gz", format: "tar.gz", files: [] })).toEqual(refused({
    kind: "archive-not-written", name: "runtime.tar.gz", reason: '{"kind":"invalid-content-hash","raw":"bad"}',
  }));
  expect(writeFile).not.toHaveBeenCalled();
});

test("folder creation failures are not successful archives", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const makeFolder = mock(async () => refused({ kind: "unwritable" as const, code: "permission-denied" as const }));
  const writeFile = mock(fileSystem.writeFile);
  expect(await createLegacyArtifactWriter({ folder, fileSystem: { makeFolder, writeFile }, hasher })
    .write({ name: "runtime.tar.gz", format: "tar.gz", files: [] })).toEqual(refused({
    kind: "archive-not-written", name: "runtime.tar.gz", reason: "permission-denied",
  }));
  expect(writeFile).not.toHaveBeenCalled();
});

test("archive write failures do not return a digest as success", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: { "file:///archives/runtime.tar.gz": "failed" } });
  expect(await createLegacyArtifactWriter({ folder, fileSystem, hasher })
    .write({ name: "runtime.tar.gz", format: "tar.gz", files: [] })).toEqual(refused({
    kind: "archive-not-written", name: "runtime.tar.gz", reason: "failed",
  }));
});
