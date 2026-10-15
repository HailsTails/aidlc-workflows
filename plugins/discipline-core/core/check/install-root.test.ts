import { describe, expect, it } from "vitest";
import { createPathPort, type PathPort } from "../platform-ports/path-port.ts";
import { installRootOf } from "./install-root.ts";

const ENTRY_URL = "file:///install/core/check/check-command.ts";
const NOT_A_FILE_URL = "https://example.invalid/core/check/check-command.ts";
const UNC_LIKE = "\\\\server\\share";

const POSIX_PATH = createPathPort({ workingDirectory: () => "/work" });

const NON_ABSOLUTE_PATH: PathPort = {
  ...POSIX_PATH,
  directoryOf: () => UNC_LIKE,
  resolve: () => UNC_LIKE,
};

describe("installRootOf", () => {
  it("is the directory three levels above the entry file", () => {
    expect(installRootOf({ path: POSIX_PATH, moduleUrl: ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "/install",
    });
  });

  it("is install-root-unresolvable with the URL when the module URL is not a file URL", () => {
    expect(installRootOf({ path: POSIX_PATH, moduleUrl: NOT_A_FILE_URL })).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: NOT_A_FILE_URL,
        detail: expect.stringMatching(/.+/),
      },
    });
  });

  it("is install-root-unresolvable with the URL when the derived directory is not absolute", () => {
    expect(installRootOf({ path: NON_ABSOLUTE_PATH, moduleUrl: ENTRY_URL })).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: ENTRY_URL,
        detail: expect.stringMatching(/.+/),
      },
    });
  });
});
