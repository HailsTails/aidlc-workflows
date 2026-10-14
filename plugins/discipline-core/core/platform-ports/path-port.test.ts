import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "./path-port.ts";

const workingDirectoryAt = (request: { readonly directory: string }) =>
  vi.fn<(request: Record<string, never>) => string>().mockReturnValue(request.directory);

const pathPortIn = (request: { readonly directory: string }) =>
  createPathPort({ workingDirectory: workingDirectoryAt({ directory: request.directory }) });

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
    ).toBe("../b/c.ts");
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

  it("normalises a .. segment that climbs out of the working directory", () => {
    expect(pathPortIn({ directory: "/work/sub" }).resolve({ path: "../a.ts" })).toBe(
      "/work/a.ts",
    );
  });
});

describe("createPathPort relative", () => {
  it("absolutises relative arguments against the injected working directory", () => {
    expect(pathPortIn({ directory: "/work/sub" }).relative({ from: "..", to: "x" })).toBe("sub/x");
  });

  it("asks the injected working directory for relative arguments", () => {
    const workingDirectory = workingDirectoryAt({ directory: "/work/sub" });

    createPathPort({ workingDirectory }).relative({ from: "..", to: "x" });

    expect(workingDirectory).toHaveBeenCalledWith({});
  });

  it("gives the relative path between two absolute arguments", () => {
    expect(pathPortIn({ directory: "/work/sub" }).relative({ from: "/a", to: "/a/b" })).toBe("b");
  });

  it("does not ask the working directory when both arguments are absolute", () => {
    const workingDirectory = workingDirectoryAt({ directory: "/work/sub" });

    createPathPort({ workingDirectory }).relative({ from: "/a", to: "/a/b" });

    expect(workingDirectory).not.toHaveBeenCalled();
  });
});
