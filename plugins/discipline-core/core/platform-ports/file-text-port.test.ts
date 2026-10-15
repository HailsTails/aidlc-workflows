import { describe, expect, it, vi } from "vitest";
import { createFileTextPort, type FileSystemSurface } from "./file-text-port.ts";

const PATH = "/repo/a.ts";

const NO_SUCH_FILE = Object.assign(new Error("ENOENT: no such file or directory, access '/repo/a.ts'"), {
  code: "ENOENT",
});

const PERMISSION_DENIED = Object.assign(new Error("EACCES: permission denied, access '/repo/a.ts'"), {
  code: "EACCES",
});

const NOT_A_DIRECTORY = Object.assign(new Error("ENOTDIR: not a directory, access '/repo/a.ts'"), {
  code: "ENOTDIR",
});

const fileSystemOver = (surface: Partial<FileSystemSurface>): FileSystemSurface => ({
  readText: vi.fn(),
  writeText: vi.fn(),
  access: vi.fn(),
  ...surface,
});

describe("createFileTextPort read", () => {
  it("reads a file's text as ok", () => {
    const readOutcome = createFileTextPort({
      fileSystem: fileSystemOver({
        readText: vi.fn<FileSystemSurface["readText"]>().mockReturnValue("export const a = 1;\n"),
      }),
    }).read({ path: PATH });

    expect(readOutcome).toEqual({ outcome: "ok", value: "export const a = 1;\n" });
  });

  it("reads the requested path", () => {
    const readText = vi.fn<FileSystemSurface["readText"]>().mockReturnValue("");

    createFileTextPort({ fileSystem: fileSystemOver({ readText }) }).read({ path: PATH });

    expect(readText).toHaveBeenCalledWith({ path: "/repo/a.ts" });
  });

  it("reads as unreadable with the path and the thrown message when reading throws", () => {
    const readOutcome = createFileTextPort({
      fileSystem: fileSystemOver({
        readText: vi
          .fn<FileSystemSurface["readText"]>()
          .mockThrow(new Error("ENOENT: no such file or directory")),
      }),
    }).read({ path: PATH });

    expect(readOutcome).toEqual({
      outcome: "failed",
      error: { kind: "unreadable", path: "/repo/a.ts", detail: "ENOENT: no such file or directory" },
    });
  });

  it("reads as unreadable with the thrown value's text when a non-Error is thrown", () => {
    const readOutcome = createFileTextPort({
      fileSystem: fileSystemOver({
        readText: vi.fn<FileSystemSurface["readText"]>().mockThrow("EACCES"),
      }),
    }).read({ path: PATH });

    expect(readOutcome).toMatchObject({ outcome: "failed", error: { detail: "EACCES" } });
  });
});

describe("createFileTextPort exists", () => {
  it("reports a path the file system can access as present", () => {
    expect(
      createFileTextPort({ fileSystem: fileSystemOver({}) }).exists({ path: PATH }),
    ).toBe("present");
  });

  it("checks access to the requested path", () => {
    const access = vi.fn<FileSystemSurface["access"]>();

    createFileTextPort({ fileSystem: fileSystemOver({ access }) }).exists({ path: PATH });

    expect(access).toHaveBeenCalledWith({ path: "/repo/a.ts" });
  });

  it("reports a path whose access throws ENOENT as absent", () => {
    expect(
      createFileTextPort({
        fileSystem: fileSystemOver({
          access: vi.fn<FileSystemSurface["access"]>().mockThrow(NO_SUCH_FILE),
        }),
      }).exists({ path: PATH }),
    ).toBe("absent");
  });

  it("reports a path whose access throws another error as present, so its read reports it", () => {
    expect(
      createFileTextPort({
        fileSystem: fileSystemOver({
          access: vi.fn<FileSystemSurface["access"]>().mockThrow(PERMISSION_DENIED),
        }),
      }).exists({ path: PATH }),
    ).toBe("present");
  });

  it("reports a path whose access throws ENOTDIR as present, so its read reports it", () => {
    expect(
      createFileTextPort({
        fileSystem: fileSystemOver({
          access: vi.fn<FileSystemSurface["access"]>().mockThrow(NOT_A_DIRECTORY),
        }),
      }).exists({ path: PATH }),
    ).toBe("present");
  });

  it("reports a path whose access throws a value with no error code as present", () => {
    expect(
      createFileTextPort({
        fileSystem: fileSystemOver({
          access: vi.fn<FileSystemSurface["access"]>().mockThrow("ENOENT"),
        }),
      }).exists({ path: PATH }),
    ).toBe("present");
  });
});

describe("createFileTextPort write", () => {
  it("writes the text to the requested path", () => {
    const writeText = vi.fn<FileSystemSurface["writeText"]>();

    createFileTextPort({ fileSystem: fileSystemOver({ writeText }) }).write({
      path: PATH,
      text: "written\n",
    });

    expect(writeText).toHaveBeenCalledWith({ path: "/repo/a.ts", text: "written\n" });
  });

  it("returns ok from a successful write", () => {
    const writeOutcome = createFileTextPort({ fileSystem: fileSystemOver({}) }).write({
      path: PATH,
      text: "written\n",
    });

    expect(writeOutcome).toEqual({ outcome: "ok", value: undefined });
  });

  it("writes as unwritable with the path and the thrown message when writing throws", () => {
    const writeOutcome = createFileTextPort({
      fileSystem: fileSystemOver({
        writeText: vi
          .fn<FileSystemSurface["writeText"]>()
          .mockThrow(new Error("ENOENT: no such file or directory")),
      }),
    }).write({ path: PATH, text: "written\n" });

    expect(writeOutcome).toEqual({
      outcome: "failed",
      error: { kind: "unwritable", path: "/repo/a.ts", detail: "ENOENT: no such file or directory" },
    });
  });
});
