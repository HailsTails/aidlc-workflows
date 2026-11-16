import { describe, expect, it } from "vitest";
import { createDefaultPackageLocationPort } from "./package-location-port.ts";

const port = createDefaultPackageLocationPort({});

const slashed = (path: string): string => path.replaceAll("\\", "/");

const thrownBy = (locate: () => string): unknown => {
  try {
    return locate();
  } catch (thrown) {
    return thrown;
  }
};

describe("createDefaultPackageLocationPort", () => {
  it("names the core install root as the folder holding core/", () => {
    expect(slashed(port.installRoot)).toMatch(/\/plugins\/discipline-core$/);
  });

  it("locates a package as the file node resolves from the core install, here the repository's own copy", () => {
    const location = slashed(port.locate({ packageName: "zod" }));
    expect({
      inNodeModules: location.includes("/node_modules/zod/"),
      insideInstall: location.startsWith(`${slashed(port.installRoot)}/`),
    }).toEqual({ inNodeModules: true, insideInstall: false });
  });

  it("throws node's module-not-found error naming the package when nothing resolves", () => {
    expect(thrownBy(() => port.locate({ packageName: "discipline-core-absent-package" }))).toMatchObject({
      code: "ERR_MODULE_NOT_FOUND",
      message: expect.stringContaining("'discipline-core-absent-package'"),
    });
  });
});
