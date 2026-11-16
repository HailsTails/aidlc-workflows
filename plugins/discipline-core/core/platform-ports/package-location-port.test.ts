import { describe, expect, it } from "vitest";
import { createDefaultPackageLocationPort } from "./package-location-port.ts";
import { createDefaultPathPort } from "./path-port.ts";

const port = createDefaultPackageLocationPort({});

const path = createDefaultPathPort({});

describe("createDefaultPackageLocationPort", () => {
  it("names the core install root as the folder holding core/", () => {
    expect(path.resolve({ path: `${import.meta.dirname}/../..` })).toEqual({ outcome: "ok", value: port.installRoot });
  });

  it("locates a package as the file node resolves from the core install, here the repository root's own copy outside the install", () => {
    expect(path.resolve({ path: `${import.meta.dirname}/../../../../node_modules/zod/index.js` })).toEqual({
      outcome: "ok",
      value: port.locate({ packageName: "zod" }),
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
