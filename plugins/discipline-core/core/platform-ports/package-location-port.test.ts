import { describe, expect, it } from "vitest";
import { createDefaultPackageLocationPort } from "./package-location-port.ts";
import { createDefaultPathPort } from "./path-port.ts";

const port = createDefaultPackageLocationPort({});

const path = createDefaultPathPort({});

describe("createDefaultPackageLocationPort", () => {
  it("names the core install root as the folder holding core/", () => {
    expect(path.resolve({ path: `${import.meta.dirname}/../..` })).toEqual({ outcome: "ok", value: port.installRoot });
  });

  it("locates a package as the file node resolves from the core install", () => {
    expect(port.locate({ packageName: "zod" })).toEqual({
      outcome: "ok",
      value: expect.stringMatching(/[\\/]zod[\\/]index\.js$/),
    });
  });

  it("reports a package that resolves to no file, such as a node builtin, as not a file URL instead of a path", () => {
    expect(port.locate({ packageName: "node:fs" })).toEqual({
      outcome: "failed",
      error: { kind: "not-a-file-url", url: "node:fs", detail: "the text is not a file: URL" },
    });
  });

  it("throws node's module-not-found error naming the package when nothing resolves", () => {
    expect(() => port.locate({ packageName: "discipline-core-absent-package" })).toThrow(
      expect.objectContaining({
        code: "ERR_MODULE_NOT_FOUND",
        message: expect.stringContaining("'discipline-core-absent-package'"),
      }),
    );
  });
});
