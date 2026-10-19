import { describe, expect, it, vi } from "vitest";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { createDirectoryPort, type DirectoryEntry, type DirectorySurface } from "./file-system-port.ts";

const DIRECTORY = absolutePathSchema.parse("H:\\Development\\project files\\src");

describe("createDirectoryPort", () => {
  it("forwards the unchanged native path once and returns all entries in UTF16 name order without mutating input", () => {
    const entries: readonly DirectoryEntry[] = Object.freeze([
      { name: "\uE000", kind: "file" },
      { name: "é", kind: "directory" },
      { name: "a", kind: "file" },
      { name: "😀", kind: "file" },
      { name: "Z", kind: "directory" },
    ]);
    const list = vi.fn<DirectorySurface["list"]>().mockReturnValue(entries);

    const directoryOutcome = createDirectoryPort({ directory: { list } }).list({ path: DIRECTORY });

    expect(directoryOutcome).toEqual({
      outcome: "ok",
      value: [
        { name: "Z", kind: "directory" },
        { name: "a", kind: "file" },
        { name: "é", kind: "directory" },
        { name: "😀", kind: "file" },
        { name: "\uE000", kind: "file" },
      ],
    });
    expect(directoryOutcome).not.toEqual({ outcome: "ok", value: entries });
    expect(entries).toEqual([
      { name: "\uE000", kind: "file" },
      { name: "é", kind: "directory" },
      { name: "a", kind: "file" },
      { name: "😀", kind: "file" },
      { name: "Z", kind: "directory" },
    ]);
    expect(list).toHaveBeenCalledExactlyOnceWith({ path: "H:\\Development\\project files\\src" });
  });

  it("returns an observed empty directory as successful empty entries", () => {
    const list = vi.fn<DirectorySurface["list"]>().mockReturnValue([]);

    expect(createDirectoryPort({ directory: { list } }).list({ path: DIRECTORY })).toEqual({
      outcome: "ok",
      value: [],
    });
    expect(list).toHaveBeenCalledExactlyOnceWith({ path: DIRECTORY });
  });

  it("preserves an external Error message and the affected directory", () => {
    const list = vi.fn<DirectorySurface["list"]>().mockThrow(new Error("directory access denied"));

    expect(createDirectoryPort({ directory: { list } }).list({ path: DIRECTORY })).toEqual({
      outcome: "failed",
      error: {
        kind: "directory-unreadable",
        path: DIRECTORY,
        detail: "directory access denied",
      },
    });
  });

  it("preserves a non-Error external failure as text with the affected directory", () => {
    const list = vi.fn<DirectorySurface["list"]>().mockThrow("directory unavailable");

    expect(createDirectoryPort({ directory: { list } }).list({ path: DIRECTORY })).toEqual({
      outcome: "failed",
      error: {
        kind: "directory-unreadable",
        path: DIRECTORY,
        detail: "directory unavailable",
      },
    });
  });
});
