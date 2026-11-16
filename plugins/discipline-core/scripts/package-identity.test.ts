import { describe, expect, it } from "vitest";
import { PACKAGE_IDENTITY } from "./package-identity.ts";

describe("PACKAGE_IDENTITY", () => {
  it("names each command after the package", () => {
    expect({ checkBin: PACKAGE_IDENTITY.checkBin, projectBin: PACKAGE_IDENTITY.projectBin }).toEqual({
      checkBin: `${PACKAGE_IDENTITY.name}-check`,
      projectBin: `${PACKAGE_IDENTITY.name}-project`,
    });
  });

  it("describes the package in one sentence", () => {
    expect(PACKAGE_IDENTITY.description).toMatch(/^[^.]+\.$/);
  });
});
