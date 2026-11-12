import { describe, expect, mock, test } from "bun:test";
import type { FileSystemFault } from "./file-system-port.ts";
import { createNodeFileSystem, type NodeFileLib } from "./file-system.ts";

const errno = (code: string): Error => Object.assign(new Error(code), { code });

const unusedWrites = {
  makeTemporaryFolder: async () => Promise.reject(errno("EIO")),
  makeFolder: async () => Promise.reject(errno("EIO")),
  writeFile: async () => Promise.reject(errno("EIO")),
  removeFolder: async () => Promise.reject(errno("EIO")),
};

const failingWith = (code: string): NodeFileLib => ({
  ...unusedWrites,
  readFile: async () => Promise.reject(errno(code)),
  readdir: async () => Promise.reject(errno(code)),
});

const folderLib: NodeFileLib = {
  ...unusedWrites,
  readFile: async () => new Uint8Array([104, 105]),
  readdir: async () => [{ name: "SKILL.md", kind: "file" }, { name: "assets", kind: "folder" }],
};

describe("createNodeFileSystem over its file library seam", () => {
  test("reads a file as bytes", async () => {
    const fileSystem = createNodeFileSystem({ fileLib: folderLib });

    expect(await fileSystem.readFile({ file: new URL("file:///core/SKILL.md") }))
      .toEqual({ ok: true, value: { kind: "bytes", bytes: new Uint8Array([104, 105]) } });
  });

  test("lists a folder's entries with their kinds", async () => {
    const fileSystem = createNodeFileSystem({ fileLib: folderLib });

    expect(await fileSystem.listFolder({ folder: new URL("file:///core/") })).toEqual({ ok: true,
      value: [{ name: "SKILL.md", kind: "file" }, { name: "assets", kind: "folder" }] });
  });

  test.each<readonly [string, FileSystemFault]>([
    ["ENOENT", "not-found"],
    ["ENOTDIR", "not-found"],
    ["EACCES", "permission-denied"],
    ["EPERM", "permission-denied"],
    ["EISDIR", "not-a-file"],
    ["EIO", "failed"],
  ])("returns %s from a read as the %s fault", async (code, fault) => {
    const fileSystem = createNodeFileSystem({ fileLib: failingWith(code) });

    expect(await fileSystem.readFile({ file: new URL("file:///core/SKILL.md") }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: fault } });
  });

  test("returns a listing failure as a fault", async () => {
    const fileSystem = createNodeFileSystem({ fileLib: failingWith("EACCES") });

    expect(await fileSystem.listFolder({ folder: new URL("file:///core/") }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: "permission-denied" } });
  });
});

const writingLib: NodeFileLib = {
  ...folderLib,
  makeTemporaryFolder: async () => new URL("file:///tmp/build/scratch-abc"),
  makeFolder: async () => undefined,
  writeFile: async () => undefined,
  removeFolder: async () => undefined,
};

describe("createNodeFileSystem writes over its file library seam", () => {
  test("returns the scratch folder it made as a folder URL", async () => {
    const fileSystem = createNodeFileSystem({ fileLib: writingLib });

    expect(await fileSystem.makeScratchFolder({ parent: new URL("file:///tmp/build/") }))
      .toEqual({ ok: true, value: new URL("file:///tmp/build/scratch-abc/") });
  });

  test("returns the file it wrote", async () => {
    const fileSystem = createNodeFileSystem({ fileLib: writingLib });

    expect(await fileSystem.writeFile({ file: new URL("file:///tmp/a.md"), content: { kind: "text", text: "a" } }))
      .toEqual({ ok: true, value: new URL("file:///tmp/a.md") });
  });

  test("passes an executable mode to the file library and defaults to regular", async () => {
    const writeFile = mock(async () => undefined);
    const fileSystem = createNodeFileSystem({ fileLib: { ...writingLib, writeFile } });
    const file = new URL("file:///tmp/a.sh");
    const content = { kind: "text", text: "a" } as const;

    await fileSystem.writeFile({ file, content, mode: "executable" });
    await fileSystem.writeFile({ file, content });

    expect(writeFile).toHaveBeenNthCalledWith(1, { file, bytes: new Uint8Array([97]), mode: "executable" });
    expect(writeFile).toHaveBeenNthCalledWith(2, { file, bytes: new Uint8Array([97]), mode: "regular" });
  });

  test("returns a write failure as an unwritable fault", async () => {
    const fileSystem = createNodeFileSystem({ fileLib: { ...writingLib, writeFile: async () => Promise.reject(errno("EACCES")) } });

    expect(await fileSystem.writeFile({ file: new URL("file:///tmp/a.md"), content: { kind: "text", text: "a" } }))
      .toEqual({ ok: false, refusal: { kind: "unwritable", code: "permission-denied" } });
  });
});
