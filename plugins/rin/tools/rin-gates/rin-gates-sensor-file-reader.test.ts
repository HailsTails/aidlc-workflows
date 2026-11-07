import { describe, expect, test, vi } from "vitest";
import {
  defaultSensorFileReader,
  type ReadUtf8,
} from "./rin-gates-sensor-file-reader.ts";

const NOT_FOUND_ERROR = Object.assign(new Error("ENOENT: no such file"), {
  code: "ENOENT",
});
const NOT_A_DIRECTORY_ERROR = Object.assign(
  new Error("ENOTDIR: not a directory"),
  {
    code: "ENOTDIR",
  },
);
const PERMISSION_DENIED_ERROR = Object.assign(
  new Error("EACCES: permission denied"),
  { code: "EACCES" },
);

describe("defaultSensorFileReader", () => {
  test("returns a readable file's text", () => {
    const readUtf8 = vi.fn<ReadUtf8>().mockReturnValue("body");
    expect(
      defaultSensorFileReader({ readUtf8 }).readText({ path: "a.md" }),
    ).toEqual({
      kind: "present",
      text: "body",
    });
    expect(readUtf8).toHaveBeenCalledWith({ path: "a.md" });
  });

  test("reads a missing file as absent", () => {
    const readUtf8 = vi.fn<ReadUtf8>().mockThrow(NOT_FOUND_ERROR);
    expect(
      defaultSensorFileReader({ readUtf8 }).readText({ path: "a.md" }),
    ).toEqual({
      kind: "absent",
    });
  });

  test("reads a path through a non-directory as absent", () => {
    const readUtf8 = vi.fn<ReadUtf8>().mockThrow(NOT_A_DIRECTORY_ERROR);
    expect(
      defaultSensorFileReader({ readUtf8 }).readText({ path: "a.md/b" }),
    ).toEqual({
      kind: "absent",
    });
  });

  test("reads any other failure as unreadable, with its message", () => {
    const readUtf8 = vi.fn<ReadUtf8>().mockThrow(PERMISSION_DENIED_ERROR);
    expect(
      defaultSensorFileReader({ readUtf8 }).readText({ path: "a.md" }),
    ).toEqual({
      kind: "unreadable",
      reason: "EACCES: permission denied",
    });
  });

  test("reads a non-Error throw as unreadable", () => {
    const readUtf8 = vi.fn<ReadUtf8>().mockThrow("boom");
    expect(
      defaultSensorFileReader({ readUtf8 }).readText({ path: "a.md" }),
    ).toEqual({
      kind: "unreadable",
      reason: "boom",
    });
  });
});
