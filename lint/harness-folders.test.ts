import { describe, expect, test } from "bun:test";
import { HARNESS_FOLDER_NAMES } from "./harness-folders.ts";

describe("HARNESS_FOLDER_NAMES", () => {
  test("names each harness folder in the repository", () => {
    expect(HARNESS_FOLDER_NAMES).toEqual(expect.arrayContaining(["claude", "kiro", "kiro-ide"]));
  });

  test("holds no file names", () => {
    expect(HARNESS_FOLDER_NAMES).not.toContain("manifest.ts");
  });
});
