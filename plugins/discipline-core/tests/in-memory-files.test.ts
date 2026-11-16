import { describe, expect, it } from "vitest";
import type { EntryDisposition } from "../scripts/install-proof-plan.ts";
import type { CopiedEntry } from "../scripts/install-proof-ports.ts";
import { inMemoryFiles } from "./in-memory-files.ts";

const LEFT_OUT_NAMES: Readonly<Record<string, EntryDisposition>> = { secrets: "left-out" };

const leaveOutSecrets = (entry: CopiedEntry): EntryDisposition => LEFT_OUT_NAMES[entry.name] ?? "kept";

describe("inMemoryFiles fileText", () => {
  it("reads a held file and reports a missing one as unreadable", () => {
    const files = inMemoryFiles({ initial: { "/repo/a.ts": "a" } });

    expect({
      held: files.fileText.read({ path: "/repo/a.ts" }),
      missing: files.fileText.read({ path: "/repo/b.ts" }),
    }).toEqual({
      held: { outcome: "ok", value: "a" },
      missing: { outcome: "failed", error: { kind: "unreadable", path: "/repo/b.ts", detail: "ENOENT" } },
    });
  });

  it("says whether a file is present", () => {
    const files = inMemoryFiles({ initial: { "/repo/a.ts": "a" } });

    expect({
      held: files.fileText.exists({ path: "/repo/a.ts" }),
      missing: files.fileText.exists({ path: "/repo/b.ts" }),
    }).toEqual({ held: "present", missing: "absent" });
  });

  it("holds what it is asked to write", () => {
    const files = inMemoryFiles({ initial: {} });

    const written = files.fileText.write({ path: "/repo/a.ts", text: "a" });

    expect({ written, texts: files.texts() }).toEqual({ written: { outcome: "ok", value: undefined }, texts: { "/repo/a.ts": "a" } });
  });
});

describe("inMemoryFiles folder queries", () => {
  const files = inMemoryFiles({ initial: { "/out/b.js": "b", "/out/chunks/a.js": "a", "/output.js": "o" } });

  it("names the files under a folder in path order, relative to it", () => {
    expect(files.pathsUnder({ folder: "/out" })).toEqual(["b.js", "chunks/a.js"]);
  });

  it("returns the texts of the files under a folder by their full paths", () => {
    expect(files.textsUnder({ folder: "/out" })).toEqual({ "/out/b.js": "b", "/out/chunks/a.js": "a" });
  });
});

describe("inMemoryFiles scratch", () => {
  it("numbers each temporary directory it creates", () => {
    const files = inMemoryFiles({ initial: {} });

    expect([
      files.scratch.createTemporaryDirectory({ prefix: "proof-" }),
      files.scratch.createTemporaryDirectory({ prefix: "proof-" }),
    ]).toEqual([
      { outcome: "ok", value: "/tmp/proof-1" },
      { outcome: "ok", value: "/tmp/proof-2" },
    ]);
  });

  it("removes a tree and nothing beside it", () => {
    const files = inMemoryFiles({ initial: { "/repo/out/a.ts": "a", "/repo/output.ts": "o", "/repo/out": "folder" } });

    const removed = files.scratch.removeTree({ path: "/repo/out" });

    expect({ removed, texts: files.texts() }).toEqual({ removed: { outcome: "ok", value: null }, texts: { "/repo/output.ts": "o" } });
  });

  it("removes one file", () => {
    const files = inMemoryFiles({ initial: { "/repo/a.ts": "a", "/repo/b.ts": "b" } });

    const removed = files.scratch.removeFile({ path: "/repo/a.ts" });

    expect({ removed, texts: files.texts() }).toEqual({ removed: { outcome: "ok", value: null }, texts: { "/repo/b.ts": "b" } });
  });

  it("makes a directory without holding a file for it", () => {
    const files = inMemoryFiles({ initial: {} });

    expect({ made: files.scratch.makeDirectory({ path: "/repo/out" }), texts: files.texts() }).toEqual({
      made: { outcome: "ok", value: null },
      texts: {},
    });
  });

  it("copies the kept files of a tree and leaves out what the disposition leaves out", () => {
    const files = inMemoryFiles({
      initial: { "/package/core/a.ts": "a", "/package/core/secrets/key.ts": "k", "/package/other.ts": "o" },
    });

    const copied = files.scratch.copyTree({ from: "/package/core", to: "/repo/core", disposition: leaveOutSecrets });

    expect({ copied, texts: files.texts() }).toEqual({
      copied: { outcome: "ok", value: null },
      texts: {
        "/package/core/a.ts": "a",
        "/package/core/secrets/key.ts": "k",
        "/package/other.ts": "o",
        "/repo/core/a.ts": "a",
      },
    });
  });

  it("lists the files under a folder in path order, relative to it", () => {
    const files = inMemoryFiles({ initial: { "/repo/core/b.ts": "b", "/repo/core/check/a.ts": "a", "/repo/other.ts": "o" } });

    expect(files.scratch.listTree({ path: "/repo/core" })).toEqual({
      outcome: "ok",
      value: [
        { path: "b.ts", name: "b.ts", entryKind: "file" },
        { path: "check/a.ts", name: "a.ts", entryKind: "file" },
      ],
    });
  });

  it("digests a held file and fails on a missing one", () => {
    const files = inMemoryFiles({ initial: { "/out/core.tgz": "tarball" } });

    expect({
      held: files.scratch.digestOf({ path: "/out/core.tgz" }),
      missing: files.scratch.digestOf({ path: "/out/absent.tgz" }),
    }).toEqual({
      held: { outcome: "ok", value: "digest of tarball" },
      missing: { outcome: "failed", error: { kind: "effect-failed", detail: "ENOENT /out/absent.tgz" } },
    });
  });
});
