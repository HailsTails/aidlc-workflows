import { describe, expect, test } from "bun:test";
import type { TreeEntry, TreeSelection } from "../file-system-port.ts";
import { createInMemoryFileSystem, selectFoldersAndFiles } from "./file-system.fake.ts";

const fileSystem = createInMemoryFileSystem({
  files: { "file:///core/stages/inception/requirements-analysis.md": "requirements", "file:///core/README.md": "readme" },
  faults: { "file:///core/agents/locked.md": "permission-denied", "file:///core/private/": "permission-denied" },
  others: ["file:///core/link"],
});

describe("createInMemoryFileSystem", () => {
  test("reads a file it holds as bytes", async () => {
    expect(await fileSystem.readFile({ file: new URL("file:///core/README.md") }))
      .toEqual({ ok: true, value: { kind: "bytes", bytes: new TextEncoder().encode("readme") } });
  });

  test("refuses a file it does not hold as not found", async () => {
    expect(await fileSystem.readFile({ file: new URL("file:///core/absent.md") }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: "not-found" } });
  });

  test("refuses a file with a fault by that fault", async () => {
    expect(await fileSystem.readFile({ file: new URL("file:///core/agents/locked.md") }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: "permission-denied" } });
  });

  test("lists a folder's files, folders and other entries once each", async () => {
    expect(await fileSystem.listFolder({ folder: new URL("file:///core/") })).toEqual({ ok: true, value: [
      { name: "stages", kind: "folder" },
      { name: "README.md", kind: "file" },
      { name: "agents", kind: "folder" },
      { name: "private", kind: "folder" },
      { name: "link", kind: "other" },
    ] });
  });

  test("refuses a folder with a fault by that fault", async () => {
    expect(await fileSystem.listFolder({ folder: new URL("file:///core/private/") }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: "permission-denied" } });
  });

  test("refuses a folder that holds nothing as not found", async () => {
    expect(await fileSystem.listFolder({ folder: new URL("file:///core/scopes/") }))
      .toEqual({ ok: false, refusal: { kind: "unreadable", code: "not-found" } });
  });
});

describe("createInMemoryFileSystem writes", () => {
  test("makes a numbered scratch folder below the parent it is given", async () => {
    const scratch = createInMemoryFileSystem({ files: {} });

    expect(await scratch.makeScratchFolder({ parent: new URL("file:///tmp/build") }))
      .toEqual({ ok: true, value: new URL("file:///tmp/build/scratch-1/") });
  });

  test("lists a folder it made even while it is empty", async () => {
    const scratch = createInMemoryFileSystem({ files: {} });
    await scratch.makeFolder({ folder: new URL("file:///tmp/output") });

    expect(await scratch.listFolder({ folder: new URL("file:///tmp/output/") })).toEqual({ ok: true, value: [] });
  });

  test("holds a written file for later reads", async () => {
    const scratch = createInMemoryFileSystem({ files: {} });
    await scratch.writeFile({ file: new URL("file:///tmp/sources/mvp.md"), content: { kind: "text", text: "mvp" } });

    expect(scratch.snapshot()).toEqual({ "file:///tmp/sources/mvp.md": { kind: "text", text: "mvp" } });
  });

  test("refuses a write with a fault as unwritable", async () => {
    const scratch = createInMemoryFileSystem({ files: {}, faults: { "file:///tmp/locked.md": "permission-denied" } });

    expect(await scratch.writeFile({ file: new URL("file:///tmp/locked.md"), content: { kind: "text", text: "x" } }))
      .toEqual({ ok: false, refusal: { kind: "unwritable", code: "permission-denied" } });
  });

  test("removes a folder with everything below it and keeps the rest", async () => {
    const scratch = createInMemoryFileSystem({ files: { "file:///tmp/a/one.md": "1", "file:///tmp/b/two.md": "2" } });
    await scratch.removeFolder({ folder: new URL("file:///tmp/a") });

    expect(scratch.snapshot()).toEqual({ "file:///tmp/b/two.md": { kind: "bytes", bytes: new TextEncoder().encode("2") } });
  });
});

describe("selectFoldersAndFiles", () => {
  const select = selectFoldersAndFiles({ files: ["stages/a.md"] });

  test.each<readonly [TreeEntry, ReturnType<TreeSelection>]>([
    [{ within: "stages", kind: "folder" }, "read"],
    [{ within: "stages/a.md", kind: "file" }, "read"],
    [{ within: "stages/b.md", kind: "file" }, "skip"],
    [{ within: "link", kind: "other" }, "skip"],
  ])("answers %o with %s", (entry, answer) => {
    expect(select(entry)).toBe(answer);
  });
});
