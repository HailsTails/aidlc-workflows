import { describe, expect, it, vi } from "vitest";
import {
  createFlavouredPathPort,
  createPathPort,
  posixPathFlavour,
  windowsPathFlavour,
} from "./path-port.ts";

const workingDirectoryAt = (request: { readonly directory: string }) =>
  vi.fn<(request: Record<string, never>) => string>().mockReturnValue(request.directory);

const UNREADABLE_WORKING_DIRECTORY = vi
  .fn<(request: Record<string, never>) => string>()
  .mockThrow(new Error("ENOENT: process.cwd failed, no such file or directory"));

const pathPortIn = (request: { readonly directory: string }) =>
  createFlavouredPathPort({
    flavour: posixPathFlavour,
    workingDirectory: workingDirectoryAt({ directory: request.directory }),
  });

const windowsPathPortIn = (request: { readonly directory: string }) =>
  createFlavouredPathPort({
    flavour: windowsPathFlavour,
    workingDirectory: workingDirectoryAt({ directory: request.directory }),
  });

const WINDOWS_ENTRY_URL = "file:///C:/repo/plugins/discipline-core/core/check/check-command.ts";

describe("createPathPort", () => {
  it("joins segments with POSIX separators", () => {
    const { join } = pathPortIn({ directory: "/work" });

    expect(join({ segments: ["/repo", "src", "a.ts"] })).toBe("/repo/src/a.ts");
  });

  it("joins segments normalising . and .. segments", () => {
    const { join } = pathPortIn({ directory: "/work" });

    expect(join({ segments: ["a", "./b", "../c"] })).toBe("a/c");
  });

  it("gives the relative path from one directory to another", () => {
    expect(
      pathPortIn({ directory: "/work" }).relative({ from: "/repo/a", to: "/repo/b/c.ts" }),
    ).toEqual({ relation: "within-root", path: "../b/c.ts" });
  });

  it("gives the directory of a path", () => {
    expect(pathPortIn({ directory: "/work" }).directoryOf({ path: "/repo/src/a.ts" })).toBe(
      "/repo/src",
    );
  });

  it("converts a file URL to its absolute path", () => {
    expect(
      pathPortIn({ directory: "/work" }).fromFileUrl({ url: "file:///repo/src/a.ts" }),
    ).toEqual({ outcome: "ok", value: "/repo/src/a.ts" });
  });

  it("converts a percent-encoded file URL to its decoded path", () => {
    expect(
      pathPortIn({ directory: "/work" }).fromFileUrl({ url: "file:///repo/%C3%A9.ts" }),
    ).toEqual({ outcome: "ok", value: "/repo/é.ts" });
  });

  it("refuses a non-file URL as not-a-file-url with the URL", () => {
    expect(
      pathPortIn({ directory: "/work" }).fromFileUrl({ url: "https://example.invalid/a.ts" }),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "not-a-file-url",
        url: "https://example.invalid/a.ts",
        detail: expect.stringMatching(/.+/),
      },
    });
  });

  it.each(["file://example.invalid/a.ts", "file:///repo/a%2Fb.ts"])(
    "refuses the file URL %j that Node cannot convert as not-a-file-url without throwing",
    (url) => {
      expect(pathPortIn({ directory: "/work" }).fromFileUrl({ url })).toMatchObject({
        outcome: "failed",
        error: { kind: "not-a-file-url", url, detail: expect.stringMatching(/.+/) },
      });
    },
  );

  it("refuses text that is not a URL as not-a-file-url without throwing", () => {
    expect(pathPortIn({ directory: "/work" }).fromFileUrl({ url: "not a url" })).toMatchObject({
      outcome: "failed",
      error: { kind: "not-a-file-url", url: "not a url" },
    });
  });
});

describe("createPathPort resolve", () => {
  it("resolves a relative path against the injected working directory", () => {
    expect(pathPortIn({ directory: "/work" }).resolve({ path: "a/b.ts" })).toBe("/work/a/b.ts");
  });

  it("asks the injected working directory for a relative path", () => {
    const workingDirectory = workingDirectoryAt({ directory: "/work" });

    createPathPort({ workingDirectory }).resolve({ path: "a/b.ts" });

    expect(workingDirectory).toHaveBeenCalledWith({});
  });

  it("resolves an absolute path to itself", () => {
    expect(pathPortIn({ directory: "/work" }).resolve({ path: "/abs/x.ts" })).toBe("/abs/x.ts");
  });

  it("does not ask the working directory for an absolute path", () => {
    const workingDirectory = workingDirectoryAt({ directory: "/work" });

    createPathPort({ workingDirectory }).resolve({ path: "/abs/x.ts" });

    expect(workingDirectory).not.toHaveBeenCalled();
  });

  it("normalises . and .. segments of an absolute path", () => {
    expect(pathPortIn({ directory: "/work" }).resolve({ path: "/repo/./src/../a.ts" })).toBe(
      "/repo/a.ts",
    );
  });

  it("returns the normalised, still relative path rather than throwing when the working directory cannot be read", () => {
    const { resolve } = createPathPort({ workingDirectory: UNREADABLE_WORKING_DIRECTORY });

    expect(resolve({ path: "./a/../b.ts" })).toBe("b.ts");
  });

  it("normalises a .. segment that climbs out of the working directory", () => {
    expect(pathPortIn({ directory: "/work/sub" }).resolve({ path: "../a.ts" })).toBe(
      "/work/a.ts",
    );
  });
});

describe("createPathPort relative", () => {
  it("absolutises relative arguments against the injected working directory", () => {
    expect(pathPortIn({ directory: "/work/sub" }).relative({ from: "..", to: "x" })).toEqual({ relation: "within-root", path: "sub/x" });
  });

  it("asks the injected working directory for relative arguments", () => {
    const workingDirectory = workingDirectoryAt({ directory: "/work/sub" });

    createPathPort({ workingDirectory }).relative({ from: "..", to: "x" });

    expect(workingDirectory).toHaveBeenCalledWith({});
  });

  it("gives the relative path between two absolute arguments", () => {
    expect(pathPortIn({ directory: "/work/sub" }).relative({ from: "/a", to: "/a/b" })).toEqual({ relation: "within-root", path: "b" });
  });

  it("does not ask the working directory when both arguments are absolute", () => {
    const workingDirectory = workingDirectoryAt({ directory: "/work/sub" });

    createPathPort({ workingDirectory }).relative({ from: "/a", to: "/a/b" });

    expect(workingDirectory).not.toHaveBeenCalled();
  });

  it("gives the relative path into a subdirectory without throwing when the working directory cannot be read", () => {
    expect(
      createPathPort({ workingDirectory: UNREADABLE_WORKING_DIRECTORY }).relative({ from: "a", to: "a/b" }),
    ).toEqual({ relation: "within-root", path: "b" });
  });

  it("gives the relative path to a sibling without throwing when the working directory cannot be read", () => {
    expect(
      createPathPort({ workingDirectory: UNREADABLE_WORKING_DIRECTORY }).relative({ from: "a", to: "c" }),
    ).toEqual({ relation: "within-root", path: "../c" });
  });
});

describe("createFlavouredPathPort with the win32 flavour", () => {
  it("converts a drive-rooted file URL to its backslashed drive path", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).fromFileUrl({ url: WINDOWS_ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "C:\\repo\\plugins\\discipline-core\\core\\check\\check-command.ts",
    });
  });

  it("gives the directory three levels above a drive-rooted file", () => {
    const { directoryOf } = windowsPathPortIn({ directory: "C:\\work" });

    expect(
      directoryOf({
        path: directoryOf({
          path: directoryOf({
            path: "C:\\repo\\plugins\\discipline-core\\core\\check\\check-command.ts",
          }),
        }),
      }),
    ).toBe("C:\\repo\\plugins\\discipline-core");
  });

  it("resolves a relative path against a drive-rooted working directory", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "x" })).toBe("C:\\work\\x");
  });

  it("resolves a path on another drive to itself", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "D:\\other" })).toBe("D:\\other");
  });

  it("normalises . and .. segments of a drive-rooted path", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "D:\\other\\.\\a\\..\\b" })).toBe(
      "D:\\other\\b",
    );
  });

  it("does not ask the working directory for a drive-rooted path", () => {
    const workingDirectory = workingDirectoryAt({ directory: "C:\\work" });

    createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory }).resolve({ path: "D:\\other" });

    expect(workingDirectory).not.toHaveBeenCalled();
  });

  it("joins a drive-rooted path and a repository path into the backslashed OS form", () => {
    const { join } = windowsPathPortIn({ directory: "C:\\work" });

    expect(join({ segments: ["C:\\repo", "src/a.ts"] })).toBe("C:\\repo\\src\\a.ts");
  });

  it("gives the relative path between two drive-rooted paths in the forward-slashed repository form", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).relative({ from: "C:\\repo", to: "C:\\repo\\src\\a.ts" }),
    ).toEqual({ relation: "within-root", path: "src/a.ts" });
  });

  it("gives the relative path to a sibling of a drive-rooted path in the forward-slashed form", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).relative({ from: "C:\\repo\\a", to: "C:\\repo\\b\\c.ts" }),
    ).toEqual({ relation: "within-root", path: "../b/c.ts" });
  });

  it("returns the normalised, still relative path rather than throwing when the working directory cannot be read", () => {
    const { resolve } = createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: UNREADABLE_WORKING_DIRECTORY });

    expect(resolve({ path: ".\\a\\..\\b.ts" })).toBe("b.ts");
  });

  it("gives the relative path into a subdirectory without throwing when the working directory cannot be read", () => {
    expect(
      createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: UNREADABLE_WORKING_DIRECTORY }).relative({
        from: "a",
        to: "a\\b",
      }),
    ).toEqual({ relation: "within-root", path: "b" });
  });

  it("gives the relative path to a sibling without throwing when the working directory cannot be read", () => {
    expect(
      createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: UNREADABLE_WORKING_DIRECTORY }).relative({
        from: "a\\x",
        to: "c\\y",
      }),
    ).toEqual({ relation: "within-root", path: "../../c/y" });
  });
});

describe("createFlavouredPathPort with the win32 flavour, drive-relative paths", () => {
  it("resolves a drive-relative path on another drive against that drive's root", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "D:x" })).toBe("D:\\x");
  });

  it("anchors a drive-relative argument of relative on its drive's root", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).relative({ from: "D:\\", to: "D:x" })).toEqual({
      relation: "within-root",
      path: "x",
    });
  });

  it("anchors a drive-relative argument of relative on its drive's root when the working directory cannot be read", () => {
    expect(
      createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: UNREADABLE_WORKING_DIRECTORY }).relative({
        from: "D:\\",
        to: "D:x",
      }),
    ).toEqual({ relation: "within-root", path: "x" });
  });

  it("resolves a drive-relative path on the working directory's drive against the working directory", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "C:x" })).toBe("C:\\work\\x");
  });

  it("matches the working directory's drive regardless of drive-letter case", () => {
    expect(windowsPathPortIn({ directory: "c:\\work" }).resolve({ path: "C:x" })).toBe("C:\\work\\x");
  });

  it("anchors a drive-relative argument of relative on the working directory when it shares the drive", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).relative({ from: "C:\\work", to: "C:x" })).toEqual({
      relation: "within-root",
      path: "x",
    });
  });
});

describe("createFlavouredPathPort with the win32 flavour, paths on different roots", () => {
  it("gives different-root for the relative path between two drives", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).relative({ from: "C:\\repo", to: "D:\\x" })).toEqual({
      relation: "different-root",
    });
  });

  it("gives different-root for the relative path between two UNC shares", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).relative({
        from: "\\\\server\\one\\repo",
        to: "\\\\server\\two\\x",
      }),
    ).toEqual({ relation: "different-root" });
  });

  it("gives the within-root relative path between two paths on one UNC share", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).relative({
        from: "\\\\server\\share\\repo",
        to: "\\\\server\\share\\repo\\src\\a.ts",
      }),
    ).toEqual({ relation: "within-root", path: "src/a.ts" });
  });
});

describe("createFlavouredPathPort with the win32 flavour, file URLs", () => {
  it("converts a UNC file URL to its backslashed share path", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).fromFileUrl({ url: "file://server/share/repo/x.ts" }),
    ).toEqual({ outcome: "ok", value: "\\\\server\\share\\repo\\x.ts" });
  });

  it("refuses a file URL that names no drive as not-a-file-url with the URL, without throwing", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).fromFileUrl({ url: "file:///x" })).toMatchObject({
      outcome: "failed",
      error: { kind: "not-a-file-url", url: "file:///x", detail: expect.stringMatching(/.+/) },
    });
  });
});

describe("createFlavouredPathPort joinRepository", () => {
  it("joins repository segments with forward slashes under the POSIX flavour", () => {
    expect(pathPortIn({ directory: "/work" }).joinRepository({ segments: ["mechanisms", "walker", "runner"] })).toBe(
      "mechanisms/walker/runner",
    );
  });

  it("joins repository segments with forward slashes under the win32 flavour", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).joinRepository({ segments: ["mechanisms", "walker", "runner"] }),
    ).toBe("mechanisms/walker/runner");
  });

  it("normalises . and .. segments of a repository join under the win32 flavour", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).joinRepository({ segments: ["mechanisms/walker/CD-14", "../runner/x.ts"] }),
    ).toBe("mechanisms/walker/runner/x.ts");
  });

  it("drops a leading . root of a repository join under the win32 flavour", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).joinRepository({ segments: [".", "mechanisms", "walker"] }),
    ).toBe("mechanisms/walker");
  });

  it("keeps the .. segments of a repository root above the join under the win32 flavour", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).joinRepository({ segments: ["../..", "core"] }),
    ).toBe("../../core");
  });
});

describe("createFlavouredPathPort with the win32 flavour, working directories without a drive or UNC root", () => {
  it("treats a rooted working directory with no drive as unreadable when resolving a relative path", () => {
    expect(windowsPathPortIn({ directory: "\\work" }).resolve({ path: "x" })).toBe("x");
  });

  it("treats a forward-slashed working directory with no drive as unreadable when resolving a relative path", () => {
    expect(windowsPathPortIn({ directory: "/work" }).resolve({ path: "x" })).toBe("x");
  });

  it("treats a drive-relative working directory as unreadable when resolving a drive-relative path on its drive", () => {
    expect(windowsPathPortIn({ directory: "D:work" }).resolve({ path: "D:x" })).toBe("D:\\x");
  });

  it("anchors a drive-relative argument of relative on its drive's root when the working directory is drive-relative", () => {
    expect(windowsPathPortIn({ directory: "D:work" }).relative({ from: "D:\\", to: "D:x" })).toEqual({
      relation: "within-root",
      path: "x",
    });
  });
});

describe("createFlavouredPathPort with the win32 flavour, rooted paths with no drive", () => {
  it("resolves a backslash-rooted path onto the drive of the working directory", () => {
    expect(windowsPathPortIn({ directory: "D:\\work" }).resolve({ path: "\\x" })).toBe("D:\\x");
  });

  it("resolves a forward-slash-rooted path onto the drive of the working directory", () => {
    expect(windowsPathPortIn({ directory: "D:\\work" }).resolve({ path: "/x" })).toBe("D:\\x");
  });

  it("resolves a backslash-rooted path onto the UNC share of the working directory", () => {
    expect(windowsPathPortIn({ directory: "\\\\server\\share\\work" }).resolve({ path: "\\x" })).toBe(
      "\\\\server\\share\\x",
    );
  });

  it("anchors a rooted argument of relative with no drive on the drive of the working directory", () => {
    expect(windowsPathPortIn({ directory: "D:\\work" }).relative({ from: "\\repo", to: "D:\\repo\\a" })).toEqual({
      relation: "within-root",
      path: "a",
    });
  });

  it("leaves a backslash-rooted path as given when the working directory cannot be read", () => {
    expect(
      createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: UNREADABLE_WORKING_DIRECTORY }).resolve({
        path: "\\x",
      }),
    ).toBe("\\x");
  });

  it("gives different-root for a rooted argument with no drive and a drive-rooted argument when the working directory cannot be read", () => {
    expect(
      createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: UNREADABLE_WORKING_DIRECTORY }).relative({
        from: "\\repo",
        to: "C:\\repo\\a",
      }),
    ).toEqual({ relation: "different-root" });
  });

  it("gives the within-root relative path between two rooted arguments with no drive when the working directory cannot be read", () => {
    expect(
      createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: UNREADABLE_WORKING_DIRECTORY }).relative({
        from: "\\repo",
        to: "\\repo\\a",
      }),
    ).toEqual({ relation: "within-root", path: "a" });
  });
});

describe("createFlavouredPathPort repositoryDirectoryOf", () => {
  it("gives the forward-slashed directory of a repository path under the POSIX flavour", () => {
    expect(pathPortIn({ directory: "/work" }).repositoryDirectoryOf({ path: "mechanisms/walker/CD-14/a.ts" })).toBe(
      "mechanisms/walker/CD-14",
    );
  });

  it("keeps a backslash inside a repository file name under the win32 flavour", () => {
    expect(
      windowsPathPortIn({ directory: "C:\\work" }).repositoryDirectoryOf({ path: "mechanisms/walker/CD-14/a\\b.ts" }),
    ).toBe("mechanisms/walker/CD-14");
  });
});
