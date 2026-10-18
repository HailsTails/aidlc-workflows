import { assert, describe, expect, it, vi } from "vitest";
import { absolutePathSchema } from "../values/absolute-path.ts";
import {
  createDirectoryPort,
  createTemporaryDirectoryPort,
  type DirectoryEntry,
  type DirectorySurface,
  type TemporaryDirectorySurface,
} from "./file-system-port.ts";
import type { PathPort } from "./path-port.ts";

const DIRECTORY = absolutePathSchema.parse("H:\\Development\\project files\\src");
const TEMPORARY_ROOT = "H:\\temporary fixtures";
const TEMPORARY_PREFIX = "H:\\temporary fixtures\\owned-";
const FIRST_ALLOCATION = absolutePathSchema.parse("H:\\temporary fixtures\\owned-first");
const SECOND_ALLOCATION = absolutePathSchema.parse("H:\\temporary fixtures\\owned-second");

const temporaryDirectoryFixture = () => {
  const root = vi.fn<TemporaryDirectorySurface["root"]>().mockReturnValue(TEMPORARY_ROOT);
  const create = vi.fn<TemporaryDirectorySurface["create"]>().mockReturnValue(FIRST_ALLOCATION);
  const remove = vi.fn<TemporaryDirectorySurface["remove"]>();
  const join = vi.fn<PathPort["join"]>().mockReturnValue(TEMPORARY_PREFIX);
  const path: PathPort = {
    join,
    joinRepository: vi.fn<PathPort["joinRepository"]>(),
    relative: vi.fn<PathPort["relative"]>(),
    directoryOf: vi.fn<PathPort["directoryOf"]>(),
    repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
    resolve: vi.fn<PathPort["resolve"]>(),
    fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
  };
  return { root, create, remove, join, path };
};

const CREATE_FAILURES: readonly {
  readonly operation: "root" | "join" | "create";
  readonly detail: string;
}[] = [
  { operation: "root", detail: "temporary root unavailable" },
  { operation: "join", detail: "temporary prefix unavailable" },
  { operation: "create", detail: "temporary allocation unavailable" },
];

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

describe("createTemporaryDirectoryPort", () => {
  it("joins the native root and requested prefix once and returns the actual validated allocation", () => {
    const fixture = temporaryDirectoryFixture();
    const directories = createTemporaryDirectoryPort({
      temporaryDirectories: fixture,
      path: fixture.path,
    });

    const allocation = directories.create({ namePrefix: "owned-" });

    expect(allocation).toMatchObject({ outcome: "ok", value: { path: FIRST_ALLOCATION } });
    expect(fixture.root).toHaveBeenCalledExactlyOnceWith({});
    expect(fixture.join).toHaveBeenCalledExactlyOnceWith({ segments: [TEMPORARY_ROOT, "owned-"] });
    expect(fixture.create).toHaveBeenCalledExactlyOnceWith({ prefix: TEMPORARY_PREFIX });
    expect(fixture.remove).not.toHaveBeenCalled();
  });

  it("binds each disposal to its allocation and permits repeated explicit disposal", () => {
    const fixture = temporaryDirectoryFixture();
    fixture.create.mockReturnValueOnce(FIRST_ALLOCATION).mockReturnValueOnce(SECOND_ALLOCATION);
    const directories = createTemporaryDirectoryPort({ temporaryDirectories: fixture, path: fixture.path });
    const first = directories.create({ namePrefix: "owned-" });
    const second = directories.create({ namePrefix: "owned-" });
    assert(first.outcome === "ok");
    assert(second.outcome === "ok");

    const firstDisposal = first.value.dispose();
    const secondDisposal = second.value.dispose();
    const repeatedDisposal = first.value.dispose();

    expect(firstDisposal).toEqual({ outcome: "ok", value: undefined });
    expect(secondDisposal).toEqual({ outcome: "ok", value: undefined });
    expect(repeatedDisposal).toEqual({ outcome: "ok", value: undefined });
    expect(fixture.remove).toHaveBeenNthCalledWith(1, { path: FIRST_ALLOCATION });
    expect(fixture.remove).toHaveBeenNthCalledWith(2, { path: SECOND_ALLOCATION });
    expect(fixture.remove).toHaveBeenNthCalledWith(3, { path: FIRST_ALLOCATION });
    expect(fixture.remove).toHaveBeenCalledTimes(3);
  });

  it.each(CREATE_FAILURES)("preserves an external $operation failure without disposing an unreturned allocation", ({ operation, detail }) => {
    const fixture = temporaryDirectoryFixture();
    fixture[operation].mockThrow(detail);
    const directories = createTemporaryDirectoryPort({ temporaryDirectories: fixture, path: fixture.path });

    expect(directories.create({ namePrefix: "owned-" })).toEqual({
      outcome: "failed",
      error: { kind: "temporary-directory-create-failed", namePrefix: "owned-", detail },
    });
    expect(fixture.remove).not.toHaveBeenCalled();
  });

  it("refuses malformed allocation output instead of returning a disposal for a relative path", () => {
    const fixture = temporaryDirectoryFixture();
    fixture.create.mockReturnValue("relative-allocation");
    const directories = createTemporaryDirectoryPort({ temporaryDirectories: fixture, path: fixture.path });

    expect(directories.create({ namePrefix: "owned-" })).toEqual({
      outcome: "failed",
      error: {
        kind: "temporary-directory-create-failed",
        namePrefix: "owned-",
        detail: expect.stringMatching(/\S/),
      },
    });
    expect(fixture.create).toHaveBeenCalledExactlyOnceWith({ prefix: TEMPORARY_PREFIX });
    expect(fixture.remove).not.toHaveBeenCalled();
  });

  it("preserves the external removal failure and its actual allocated path", () => {
    const fixture = temporaryDirectoryFixture();
    fixture.remove.mockThrow(new Error("allocated directory removal refused"));
    const allocation = createTemporaryDirectoryPort({ temporaryDirectories: fixture, path: fixture.path })
      .create({ namePrefix: "owned-" });
    assert(allocation.outcome === "ok");

    expect(allocation.value.dispose()).toEqual({
      outcome: "failed",
      error: {
        kind: "temporary-directory-remove-failed",
        path: FIRST_ALLOCATION,
        detail: "allocated directory removal refused",
      },
    });
    expect(fixture.remove).toHaveBeenCalledExactlyOnceWith({ path: FIRST_ALLOCATION });
  });
});
