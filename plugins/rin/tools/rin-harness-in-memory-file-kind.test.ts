import { describe, expect, test } from "vitest";
import { inMemoryFileKindPort } from "./rin-harness-in-memory-file-kind.ts";

const fileKind = inMemoryFileKindPort({ files: ["/repo/a.ts", "/repo/b.ts"], directories: ["/repo/src"] });

describe("inMemoryFileKindPort", () => {
  test("a listed file is a file", () => {
    expect(fileKind.isFile("/repo/b.ts")).toBe(true);
  });

  test("a path that is not listed is not a file", () => {
    expect(fileKind.isFile("/repo/c.ts")).toBe(false);
  });

  test("a listed directory is not a file", () => {
    expect(fileKind.isFile("/repo/src")).toBe(false);
  });

  test("a listed directory is a directory", () => {
    expect(fileKind.isDirectory("/repo/src")).toBe(true);
  });

  test("a listed file is not a directory", () => {
    expect(fileKind.isDirectory("/repo/a.ts")).toBe(false);
  });

  test("a path that is not listed is not a directory", () => {
    expect(fileKind.isDirectory("/repo/lib")).toBe(false);
  });
});
