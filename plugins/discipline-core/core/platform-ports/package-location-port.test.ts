import { describe, expect, it } from "vitest";
import { createDefaultPackageLocationPort, installRootOfRunnerEntry } from "./package-location-port.ts";

const slashed = (path: string): string => path.replaceAll("\\", "/");

const sourceRunnerEntry = new URL("../../mechanisms/audit/runner/runner.ts", import.meta.url).href;

const port = createDefaultPackageLocationPort({ installRoot: installRootOfRunnerEntry({ entryUrl: sourceRunnerEntry }) });

const thrownBy = (locate: () => string): unknown => {
  try {
    return locate();
  } catch (thrown) {
    return thrown;
  }
};

describe("installRootOfRunnerEntry", () => {
  it("is the folder holding mechanisms/ above a built runner entry, wherever the code reading it was bundled", () => {
    const entryUrl = new URL("../../../installed-core/mechanisms/eslint/runner/runner.js", import.meta.url).href;
    expect(slashed(installRootOfRunnerEntry({ entryUrl }))).toMatch(/\/plugins\/installed-core$/);
  });

  it("is this source install's root for a source runner entry", () => {
    expect(slashed(installRootOfRunnerEntry({ entryUrl: sourceRunnerEntry }))).toMatch(/\/plugins\/discipline-core$/);
  });
});

describe("createDefaultPackageLocationPort", () => {
  it("names the install root it is given", () => {
    expect(createDefaultPackageLocationPort({ installRoot: "/given/install" }).installRoot).toBe("/given/install");
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
