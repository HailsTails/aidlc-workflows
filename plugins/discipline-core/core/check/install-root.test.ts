import { describe, expect, it } from "vitest";
import {
  createFlavouredPathPort,
  type PathPort,
  posixPathFlavour,
  windowsPathFlavour,
} from "../platform-ports/path-port.ts";
import { installRootOf } from "./install-root.ts";

const ENTRY_URL = "file:///install/core/check/check-command.ts";
const NOT_A_FILE_URL = "https://example.invalid/core/check/check-command.ts";
const UNC_LIKE = "\\\\server\\share";

const WINDOWS_ENTRY_URL = "file:///C:/repo/plugins/discipline-core/core/check/check-command.ts";

const WINDOWS_UNC_ENTRY_URL = "file://server/share/repo/plugins/discipline-core/core/check/check-command.ts";

const POSIX_PATH = createFlavouredPathPort({ flavour: posixPathFlavour, workingDirectory: () => "/work" });

const WINDOWS_PATH = createFlavouredPathPort({ flavour: windowsPathFlavour, workingDirectory: () => "C:\\work" });

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

  it("is the drive-rooted directory three levels above a Windows entry file", () => {
    expect(installRootOf({ path: WINDOWS_PATH, moduleUrl: WINDOWS_ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "C:\\repo\\plugins\\discipline-core",
    });
  });

  it("is the UNC share directory three levels above a Windows entry file on a share", () => {
    expect(installRootOf({ path: WINDOWS_PATH, moduleUrl: WINDOWS_UNC_ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "\\\\server\\share\\repo\\plugins\\discipline-core",
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
