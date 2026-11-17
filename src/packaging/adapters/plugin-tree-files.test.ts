import { expect, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import type { ArchiveEntry } from "../domain/artifact.ts";
import { readPluginTreeFiles } from "./plugin-tree-files.ts";

const root = new URL("file:///built-plugins/");

test("plugin additions preserve dot folders, POSIX paths and binary content", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///built-plugins/.catalogue/data.json": "catalogue",
    "file:///built-plugins/demo/codex/.codex/data.bin": new Uint8Array([0, 255]),
  } });
  expect(await readPluginTreeFiles({ root, fileSystem })).toEqual(accepted([{
    entry: brand<ArchiveEntry>("plugins/.catalogue/data.json"),
    content: { kind: "bytes", bytes: new TextEncoder().encode("catalogue") }, mode: "regular",
  }, { entry: brand<ArchiveEntry>("plugins/demo/codex/.codex/data.bin"),
    content: { kind: "bytes", bytes: new Uint8Array([0, 255]) }, mode: "regular" }]));
});

test("an absent optional plugin tree keeps the legacy empty outcome", async () => {
  expect(await readPluginTreeFiles({ root, fileSystem: createInMemoryFileSystem({ files: {} }) }))
    .toEqual(accepted([]));
});

test("a root read failure names the root rather than reporting an empty archive", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: { "file:///built-plugins/": "permission-denied" } });
  expect(await readPluginTreeFiles({ root, fileSystem }))
    .toEqual(refused([{ kind: "plugin-tree-unreadable", within: "", code: "permission-denied" }]));
});

test("all unreadable plugin entries refuse the read without accepting partial files", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { "file:///built-plugins/keep.txt": "readable" }, faults: {
    "file:///built-plugins/demo/a.md": "permission-denied", "file:///built-plugins/demo/b.md": "failed",
  } });
  expect(await readPluginTreeFiles({ root, fileSystem })).toEqual(refused([
    { kind: "plugin-tree-unreadable", within: "demo/a.md", code: "permission-denied" },
    { kind: "plugin-tree-unreadable", within: "demo/b.md", code: "failed" },
  ]));
});
