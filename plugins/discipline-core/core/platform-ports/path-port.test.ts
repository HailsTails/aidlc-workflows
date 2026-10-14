import { describe, expect, it } from "vitest";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { createPathPort } from "./path-port.ts";

describe("createPathPort", () => {
  it("joins segments with POSIX separators", () => {
    expect(createPathPort({}).join({ segments: ["/repo", "src", "a.ts"] })).toBe(
      "/repo/src/a.ts",
    );
  });

  it("joins segments normalising . and .. segments", () => {
    expect(createPathPort({}).join({ segments: ["a", "./b", "../c"] })).toBe(
      "a/c",
    );
  });

  it("gives the relative path from one directory to another", () => {
    expect(
      createPathPort({}).relative({ from: "/repo/a", to: "/repo/b/c.ts" }),
    ).toBe("../b/c.ts");
  });

  it("gives the directory of a path", () => {
    expect(createPathPort({}).directoryOf({ path: "/repo/src/a.ts" })).toBe(
      "/repo/src",
    );
  });

  it("converts a file URL to its absolute path", () => {
    expect(
      createPathPort({}).fromFileUrl({ url: "file:///repo/src/a.ts" }),
    ).toEqual({ outcome: "ok", value: "/repo/src/a.ts" });
  });

  it("converts a percent-encoded file URL to its decoded path", () => {
    expect(
      createPathPort({}).fromFileUrl({ url: "file:///repo/%C3%A9.ts" }),
    ).toEqual({ outcome: "ok", value: "/repo/é.ts" });
  });

  it("refuses a non-file URL as not-a-file-url with the URL", () => {
    expect(
      createPathPort({}).fromFileUrl({ url: "https://example.invalid/a.ts" }),
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
      expect(createPathPort({}).fromFileUrl({ url })).toMatchObject({
        outcome: "failed",
        error: { kind: "not-a-file-url", url, detail: expect.stringMatching(/.+/) },
      });
    },
  );

  it("refuses text that is not a URL as not-a-file-url without throwing", () => {
    expect(createPathPort({}).fromFileUrl({ url: "not a url" })).toMatchObject({
      outcome: "failed",
      error: { kind: "not-a-file-url", url: "not a url" },
    });
  });
});

describe("createPathPort resolve (a throw on a deleted working directory is a startup invariant CD-10 allows and is not modelled)", () => {
  it("resolves an absolute path by normalising it", () => {
    expect(createPathPort({}).resolve({ path: "/repo/./src/../a.ts" })).toBe(
      "/repo/a.ts",
    );
  });

  it("resolves a relative path to an absolute path", () => {
    expect(
      absolutePathSchema.safeParse(createPathPort({}).resolve({ path: "repo" }))
        .success,
    ).toBe(true);
  });

  it("resolves a relative path to a path ending in that relative path", () => {
    expect(createPathPort({}).resolve({ path: "repo/a.ts" })).toMatch(
      /\/repo\/a\.ts$/,
    );
  });
});
