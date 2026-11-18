import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import type { FileSystem } from "../../kernel/file-system-port.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { captureReleaseEntrypoints } from "./release-entrypoints.ts";

const core = new URL("file:///core/");

test("release entrypoints retain only file .ts entries, admit their source paths and sort without deduplicating", async () => {
  const listFolder = mock<FileSystem["listFolder"]>()
    .mockResolvedValueOnce(accepted([{ name: "z.ts", kind: "file" }, { name: "nested.ts", kind: "folder" },
      { name: "upper.TS", kind: "file" }, { name: "note.md", kind: "file" }, { name: "link.ts", kind: "other" }]))
    .mockResolvedValueOnce(accepted([{ name: "b.ts", kind: "file" }, { name: "a.ts", kind: "file" },
      { name: "a.ts", kind: "file" }]));
  expect(await captureReleaseEntrypoints({ core, reader: { listFolder } })).toEqual(accepted([
    source("hooks/z.ts"), source("tools/a.ts"), source("tools/a.ts"), source("tools/b.ts"),
  ]));
  expect(listFolder).toHaveBeenCalledTimes(2);
  expect(listFolder).toHaveBeenNthCalledWith(1, { folder: new URL("file:///core/hooks/") });
  expect(listFolder).toHaveBeenNthCalledWith(2, { folder: new URL("file:///core/tools/") });
});

test("folder failures preserve hooks-before-tools order and the existing neutral source refusal", async () => {
  const listFolder = mock<FileSystem["listFolder"]>()
    .mockResolvedValueOnce(refused({ kind: "unreadable", code: "permission-denied" }))
    .mockResolvedValueOnce(refused({ kind: "unreadable", code: "not-found" }));
  expect(await captureReleaseEntrypoints({ core, reader: { listFolder } })).toEqual(refused([
    { kind: "neutral-source-unreadable", source: source("hooks"), reason: "permission-denied" },
    { kind: "neutral-source-unreadable", source: source("tools"), reason: "not-found" },
  ]));
});

test("a folder refusal still precedes an invalid entry from the other successful listing", async () => {
  const listFolder = mock<FileSystem["listFolder"]>()
    .mockResolvedValueOnce(accepted([{ name: "../invalid.ts", kind: "file" }]))
    .mockResolvedValueOnce(refused({ kind: "unreadable", code: "not-found" }));
  expect(await captureReleaseEntrypoints({ core, reader: { listFolder } })).toEqual(refused([
    { kind: "neutral-source-unreadable", source: source("tools"), reason: "not-found" },
  ]));
});

test("invalid source names retain their typed refusals before any sorted success", async () => {
  const listFolder = mock<FileSystem["listFolder"]>()
    .mockResolvedValueOnce(accepted([{ name: "../invalid.ts", kind: "file" }]))
    .mockResolvedValueOnce(accepted([{ name: "bad:name.ts", kind: "file" }]));
  expect(await captureReleaseEntrypoints({ core, reader: { listFolder } })).toEqual(refused([
    { kind: "invalid-path", base: "source", raw: "hooks/../invalid.ts" },
    { kind: "invalid-path", base: "source", raw: "tools/bad:name.ts" },
  ]));
});
