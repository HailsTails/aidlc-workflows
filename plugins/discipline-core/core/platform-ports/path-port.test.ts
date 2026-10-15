import { describe, expect, it, vi } from "vitest";
import {
  createDefaultPathPort,
  createPathPort,
} from "./path-port.ts";

const workingDirectoryAt = (request: { readonly directory: string }) =>
  vi.fn<(request: Record<string, never>) => string>().mockReturnValue(request.directory);

const pathPortIn = (request: { readonly directory: string }) =>
  createPathPort({
    flavour: "posix",
    workingDirectory: workingDirectoryAt({ directory: request.directory }),
  });

const windowsPathPortIn = (request: { readonly directory: string }) =>
  createPathPort({
    flavour: "windows",
    workingDirectory: workingDirectoryAt({ directory: request.directory }),
  });

const WINDOWS_ENTRY_URL = "file:///C:/repo/plugins/discipline-core/core/check/check-command.ts";

describe("createDefaultPathPort", () => {
  it("joins and splits paths with the host platform's path flavour", () => {
    const platformPort = createPathPort({
      flavour: "platform",
      workingDirectory: workingDirectoryAt({ directory: "/work" }),
    });
    const { join: joinDefault, directoryOf: directoryOfDefault } = createDefaultPathPort({});
    const { join: joinPlatform, directoryOf: directoryOfPlatform } = platformPort;

    expect({
      joined: joinDefault({ segments: ["a", "b", "c.ts"] }),
      directory: directoryOfDefault({ path: "a\\b" }),
    }).toEqual({
      joined: joinPlatform({ segments: ["a", "b", "c.ts"] }),
      directory: directoryOfPlatform({ path: "a\\b" }),
    });
  });
});

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
});

describe("createPathPort resolve", () => {
  it("refuses a relative path when the working directory has no root", () => {
    expect(pathPortIn({ directory: "work" }).resolve({ path: "a.ts" })).toEqual({
      outcome: "failed",
      error: { kind: "working-directory-unusable", path: "a.ts" },
    });
  });

  it("resolves a relative path against the injected working directory", () => {
    expect(pathPortIn({ directory: "/work" }).resolve({ path: "a/b.ts" })).toEqual({ outcome: "ok", value: "/work/a/b.ts" });
  });

  it("resolves an absolute path to itself", () => {
    expect(pathPortIn({ directory: "/work" }).resolve({ path: "/abs/x.ts" })).toEqual({ outcome: "ok", value: "/abs/x.ts" });
  });

  it("normalises a .. segment that climbs out of the working directory", () => {
    expect(pathPortIn({ directory: "/work/sub" }).resolve({ path: "../a.ts" })).toEqual({ outcome: "ok", value: "/work/a.ts" });
  });
});

describe("createPathPort relative", () => {
  it("absolutises relative arguments against the injected working directory", () => {
    expect(pathPortIn({ directory: "/work/sub" }).relative({ from: "..", to: "x" })).toEqual({ relation: "within-root", path: "sub/x" });
  });

  it("gives the relative path between two absolute arguments", () => {
    expect(pathPortIn({ directory: "/work/sub" }).relative({ from: "/a", to: "/a/b" })).toEqual({ relation: "within-root", path: "b" });
  });
});

describe("createPathPort with the win32 flavour", () => {
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
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "x" })).toEqual({ outcome: "ok", value: "C:\\work\\x" });
  });

  it("resolves a path on another drive to itself", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "D:\\other" })).toEqual({ outcome: "ok", value: "D:\\other" });
  });

  it("normalises . and .. segments of a drive-rooted path", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).resolve({ path: "D:\\other\\.\\a\\..\\b" })).toEqual({ outcome: "ok", value: "D:\\other\\b" });
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
});

describe("createPathPort with the win32 flavour, paths on different roots", () => {
  it("gives different-root for the relative path between two drives", () => {
    expect(windowsPathPortIn({ directory: "C:\\work" }).relative({ from: "C:\\repo", to: "D:\\x" })).toEqual({
      relation: "different-root",
    });
  });
});

describe("createPathPort joinRepository", () => {
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
});

describe("createPathPort repositoryDirectoryOf", () => {
  it("gives the forward-slashed directory of a repository path under the POSIX flavour", () => {
    expect(pathPortIn({ directory: "/work" }).repositoryDirectoryOf({ path: "mechanisms/walker/CD-14/a.ts" })).toBe(
      "mechanisms/walker/CD-14",
    );
  });
});
