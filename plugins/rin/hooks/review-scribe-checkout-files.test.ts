import { describe, expect, type Mock, test, vi } from "vitest";
import {
  defaultScribeCheckoutFiles,
  type NodeFileSystem,
} from "./review-scribe-checkout-files.ts";

type FakeFileSystem = {
  readonly fileSystem: NodeFileSystem;
  readonly makeTemporaryDirectory: Mock<
    NodeFileSystem["makeTemporaryDirectory"]
  >;
  readonly makeDirectory: Mock<NodeFileSystem["makeDirectory"]>;
  readonly writeFile: Mock<NodeFileSystem["writeFile"]>;
  readonly readFile: Mock<NodeFileSystem["readFile"]>;
  readonly remove: Mock<NodeFileSystem["remove"]>;
};

const fakeFileSystem = (): FakeFileSystem => {
  const makeTemporaryDirectory = vi
    .fn<NodeFileSystem["makeTemporaryDirectory"]>()
    .mockReturnValue("/tmp/rin-scribe-replay-abc123");
  const makeDirectory = vi.fn<NodeFileSystem["makeDirectory"]>();
  const writeFile = vi.fn<NodeFileSystem["writeFile"]>();
  const readFile = vi.fn<NodeFileSystem["readFile"]>();
  const remove = vi.fn<NodeFileSystem["remove"]>();
  return {
    fileSystem: {
      temporaryDirectory: vi
        .fn<NodeFileSystem["temporaryDirectory"]>()
        .mockReturnValue("/tmp"),
      makeTemporaryDirectory,
      makeDirectory,
      writeFile,
      readFile,
      remove,
    },
    makeTemporaryDirectory,
    makeDirectory,
    writeFile,
    readFile,
    remove,
  };
};

describe("defaultScribeCheckoutFiles", () => {
  test("makes its scratch directory under the temporary directory with the replay prefix", () => {
    const { fileSystem, makeTemporaryDirectory } = fakeFileSystem();

    expect(
      defaultScribeCheckoutFiles({ fileSystem }).makeScratchDirectory(),
    ).toBe("/tmp/rin-scribe-replay-abc123");
    expect(makeTemporaryDirectory.mock.calls).toEqual([
      ["/tmp/rin-scribe-replay-"],
    ]);
  });

  test("makes a directory together with every missing parent", () => {
    const { fileSystem, makeDirectory } = fakeFileSystem();

    defaultScribeCheckoutFiles({ fileSystem }).makeDirectory({
      path: "/scratch/a/b",
    });

    expect(makeDirectory.mock.calls).toEqual([
      ["/scratch/a/b", { recursive: true }],
    ]);
  });

  test("writes text as UTF-8", () => {
    const { fileSystem, writeFile } = fakeFileSystem();

    defaultScribeCheckoutFiles({ fileSystem }).writeText({
      path: "/scratch/note.txt",
      text: "hello — world\n",
    });

    expect(writeFile.mock.calls).toEqual([
      ["/scratch/note.txt", "hello — world\n", "utf-8"],
    ]);
  });

  test("reads text as UTF-8 and returns what the file system read", () => {
    const { fileSystem, readFile } = fakeFileSystem();
    readFile.mockReturnValueOnce("verdict text");

    expect(
      defaultScribeCheckoutFiles({ fileSystem }).readText({
        path: "/scratch/review-verdict.json",
      }),
    ).toBe("verdict text");
    expect(readFile.mock.calls).toEqual([
      ["/scratch/review-verdict.json", "utf-8"],
    ]);
  });

  test("removes a tree recursively and tolerates one already gone", () => {
    const { fileSystem, remove } = fakeFileSystem();

    defaultScribeCheckoutFiles({ fileSystem }).removeTree({
      path: "/scratch",
    });

    expect(remove.mock.calls).toEqual([
      ["/scratch", { recursive: true, force: true }],
    ]);
  });
});
