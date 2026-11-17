import { expect, mock, test } from "bun:test";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import { writePayloadTree } from "./payload-tree-writer.ts";

const binaryFile = () => ({ path: path(".claude/nested/a #.bin"), mode: "regular" as const,
  hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
  origin: { kind: "version-stamp" as const },
  content: { kind: "bytes" as const, bytes: new Uint8Array([0, 255, 10]) },
});
const writerPayload = () => ({ ...claudeCopyPayloadFixture, files: [binaryFile()] });
const root = new URL("file:///output/claude");

test("the writer sweeps only the requested root and writes binary paths through the capability", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///output/claude/stale": "old", "file:///output/other/keep": "keep",
  } });
  expect(await writePayloadTree({ root, payload: writerPayload(), fileSystem }))
    .toEqual({ ok: true, value: new URL("file:///output/claude/") });
  expect(fileSystem.snapshot()).toEqual({
    "file:///output/other/keep": { kind: "bytes", bytes: new TextEncoder().encode("keep") },
    "file:///output/claude/.claude/nested/a%20%23.bin": { kind: "bytes", bytes: new Uint8Array([0, 255, 10]) },
  });
});

test("the writer forwards executable and regular modes through the one filesystem port", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  expect(await writePayloadTree({ root, fileSystem, payload: {
    ...writerPayload(), files: [{ ...binaryFile(), mode: "executable" },
      { ...binaryFile(), path: path("regular.txt"), mode: "regular" }],
  } })).toEqual({ ok: true, value: new URL("file:///output/claude/") });
  expect(fileSystem.modes()).toEqual({
    "file:///output/claude/.claude/nested/a%20%23.bin": "executable",
    "file:///output/claude/regular.txt": "regular",
  });
});
test("a write refusal is returned instead of successful partial output", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: {
    "file:///output/claude/.claude/nested/a%20%23.bin": "permission-denied",
  } });
  const writeFile = mock(fileSystem.writeFile);
  expect(await writePayloadTree({ root, payload: { ...writerPayload(), files: [binaryFile(),
    { ...binaryFile(), path: path("later.bin") }] }, fileSystem: { ...fileSystem, writeFile } }))
    .toEqual({ ok: false, refusal: { kind: "unwritable", code: "permission-denied" } });
  expect(writeFile).toHaveBeenCalledTimes(1);
});
