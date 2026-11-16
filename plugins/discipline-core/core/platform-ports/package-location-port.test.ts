import { describe, expect, it } from "vitest";
import { createDefaultPackageLocationPort, installRootOfRunnerEntry } from "./package-location-port.ts";
import { createDefaultPathPort } from "./path-port.ts";

const path = createDefaultPathPort({});

const SOURCE_INSTALL_ROOT = path.resolve({ path: `${import.meta.dirname}/../..` });

const port = createDefaultPackageLocationPort({ installRoot: "/given/install", installForm: "package" });

describe("installRootOfRunnerEntry", () => {
  it("is the folder holding mechanisms/ above a built runner entry, wherever the code reading it was bundled", () => {
    expect(
      path.resolve({ path: installRootOfRunnerEntry({ entryFile: `${import.meta.dirname}/../../../installed-core/mechanisms/eslint/runner/runner.js` }) }),
    ).toEqual(path.resolve({ path: `${import.meta.dirname}/../../../installed-core` }));
  });

  it("is this source install's root for a source runner entry", () => {
    expect(
      path.resolve({ path: installRootOfRunnerEntry({ entryFile: `${import.meta.dirname}/../../mechanisms/audit/runner/runner.ts` }) }),
    ).toEqual(SOURCE_INSTALL_ROOT);
  });
});

describe("createDefaultPackageLocationPort", () => {
  it("names the install root and form it is given", () => {
    expect({ installRoot: port.installRoot, installForm: port.installForm }).toEqual({ installRoot: "/given/install", installForm: "package" });
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
