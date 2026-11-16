import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import type { FileSystem } from "../../kernel/file-system-port.ts";
import { createOutputTrees } from "./output-trees.ts";

const root = new URL("file:///repo/");
const scratchParent = new URL("file:///scratch/");

test("cleanup uses removeEntry at the exact file or directory URL and accepts only not-found", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { "file:///repo/stray.txt": "old",
    "file:///repo/stray-folder/keep.txt": "old", "file:///repo/retained.txt": "keep" } });
  const removeEntry = mock<FileSystem["removeEntry"]>(fileSystem.removeEntry);
  const removeFolder = mock<FileSystem["removeFolder"]>(fileSystem.removeFolder);
  const outputs = createOutputTrees({ root, scratchParent, fileSystem: { ...fileSystem, removeEntry, removeFolder },
    written: () => undefined });
  expect(await outputs.remove(new URL("stray.txt", root))).toEqual(accepted(new URL("stray.txt", root)));
  expect(await outputs.remove(new URL("stray-folder", root))).toEqual(accepted(new URL("stray-folder", root)));
  expect(await outputs.remove(new URL("absent", root))).toEqual(accepted(new URL("absent", root)));
  expect(removeEntry.mock.calls).toEqual([[{ entry: new URL("stray.txt", root) }],
    [{ entry: new URL("stray-folder", root) }], [{ entry: new URL("absent", root) }]]);
  expect(removeFolder).not.toHaveBeenCalled();
  expect(fileSystem.snapshot()).toEqual({ "file:///repo/retained.txt": { kind: "bytes", bytes: new Uint8Array([107, 101, 101, 112]) } });
});

test("permission failures pass back as output failures rather than successful absent cleanup", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const removeEntry = mock<FileSystem["removeEntry"]>(async () =>
    refused({ kind: "unwritable", code: "permission-denied" }));
  const outputs = createOutputTrees({ root, scratchParent, fileSystem: { ...fileSystem, removeEntry },
    written: () => undefined });
  expect(await outputs.remove(new URL("locked", root))).toEqual(refused({ kind: "output-tree-failed",
    operation: "remove", path: "file:///repo/locked", reason: "permission-denied" }));
});

test("absent output roots list as empty, but unreadable roots and members refuse", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {}, faults: { "file:///repo/locked/": "permission-denied" },
    others: ["file:///repo/unknown-entry"] });
  const outputs = createOutputTrees({ root, scratchParent, fileSystem, written: () => undefined });
  expect(await outputs.list(new URL("absent/", root))).toEqual(accepted([]));
  expect(await outputs.read(new URL("absent/", root))).toEqual(accepted([]));
  expect(await outputs.list(new URL("locked/", root))).toEqual(refused({ kind: "output-tree-failed",
    operation: "list", path: "file:///repo/locked/", reason: "permission-denied" }));
  expect(await outputs.read(root)).toEqual(refused({ kind: "output-tree-failed", operation: "read",
    path: root.href, reason: "locked/: permission-denied" }));
});
