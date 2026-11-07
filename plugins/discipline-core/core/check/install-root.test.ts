import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import type { Result } from "../values/result.ts";
import { installRootOf } from "./install-root.ts";

const ENTRY_URL = "file:///install/core/check/check-command.ts";
const NOT_A_FILE_URL = "https://example.invalid/core/check/check-command.ts";
const WINDOWS_ENTRY_URL = "file:///C:/repo/plugins/discipline-core/core/check/check-command.ts";

type FileUrlResult = Result<
  AbsolutePath,
  { readonly kind: "not-a-file-url"; readonly url: string; readonly detail: string }
>;

const FILE_URLS: Readonly<Record<string, FileUrlResult>> = {
  [ENTRY_URL]: { outcome: "ok", value: absolutePathSchema.parse("/install/core/check/check-command.ts") },
  [WINDOWS_ENTRY_URL]: {
    outcome: "ok",
    value: absolutePathSchema.parse("C:\\repo\\plugins\\discipline-core\\core\\check\\check-command.ts"),
  },
  [NOT_A_FILE_URL]: {
    outcome: "failed",
    error: { kind: "not-a-file-url", url: NOT_A_FILE_URL, detail: "the text is not a file: URL" },
  },
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/core/check/check-command.ts": "/install/core/check",
  "/install/core/check": "/install/core",
  "/install/core": "/install",
  "C:\\repo\\plugins\\discipline-core\\core\\check\\check-command.ts": "C:\\repo\\plugins\\discipline-core\\core\\check",
  "C:\\repo\\plugins\\discipline-core\\core\\check": "C:\\repo\\plugins\\discipline-core\\core",
  "C:\\repo\\plugins\\discipline-core\\core": "C:\\repo\\plugins\\discipline-core",
};

const TABLE_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: ({ url }) => requiredEntry({ table: FILE_URLS, key: url }),
};

const UNRESOLVABLE_PATH: PathPort = {
  ...TABLE_PATH,
  resolve: ({ path }) => ({ outcome: "failed", error: { kind: "working-directory-unusable", path } }),
};

describe("installRootOf", () => {
  it("is the directory three levels above the entry file", () => {
    expect(installRootOf({ path: TABLE_PATH, moduleUrl: ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "/install",
    });
  });

  it("is the drive-rooted directory three levels above a Windows entry file", () => {
    expect(installRootOf({ path: TABLE_PATH, moduleUrl: WINDOWS_ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "C:\\repo\\plugins\\discipline-core",
    });
  });

  it("is install-root-unresolvable with the URL when the module URL is not a file URL", () => {
    expect(installRootOf({ path: TABLE_PATH, moduleUrl: NOT_A_FILE_URL })).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: NOT_A_FILE_URL,
        detail: "the text is not a file: URL",
      },
    });
  });

  it("is install-root-unresolvable with the module URL when the directory above the entry file resolves to no absolute path", () => {
    expect(installRootOf({ path: UNRESOLVABLE_PATH, moduleUrl: ENTRY_URL })).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: ENTRY_URL,
        detail: "the install root three directories above the entry file is not an absolute path",
      },
    });
  });
});
