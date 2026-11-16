import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { coreInstallOf } from "./core-install.ts";

const INSTALL_ROOT = absolutePathSchema.parse("/repo/node_modules/discipline-core");

const MANIFEST = "/repo/node_modules/discipline-core/package.json";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const fileTextHolding = (request: { readonly text: string }): FileTextPort => ({
  read: ({ path }) =>
    path === MANIFEST
      ? { outcome: "ok", value: request.text }
      : { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } },
  exists: ({ path }) => (path === MANIFEST ? "present" : "absent"),
  write: vi.fn<FileTextPort["write"]>(),
});

const fileTextWithoutManifest: FileTextPort = {
  read: vi.fn<FileTextPort["read"]>(),
  exists: () => "absent",
  write: vi.fn<FileTextPort["write"]>(),
};

const fileTextFailingToRead: FileTextPort = {
  read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "EACCES" } }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
};

describe("coreInstallOf", () => {
  it("is a package when built core runs from an install whose package.json names it, as a built package install ships it", () => {
    expect(
      coreInstallOf({ fileText: fileTextHolding({ text: '{ "name": "discipline-core", "type": "module" }' }), path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" }),
    ).toEqual({ outcome: "ok", value: { form: "package", root: INSTALL_ROOT, name: "discipline-core" } });
  });

  it("is a folder when the install's package.json names no package, as the copy route's install manifest does", () => {
    expect(
      coreInstallOf({ fileText: fileTextHolding({ text: '{ "private": true, "type": "module" }' }), path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" }),
    ).toEqual({ outcome: "ok", value: { form: "folder" } });
  });

  it("is a folder when core runs from source, even when a copied install's package.json names a package", () => {
    expect(
      coreInstallOf({
        fileText: fileTextHolding({ text: '{ "name": "tools-discipline-core", "type": "module" }' }),
        path: posixPath,
        installRoot: INSTALL_ROOT,
        moduleExtension: ".ts",
      }),
    ).toEqual({ outcome: "ok", value: { form: "folder" } });
  });

  it("is a folder when the install has no package.json", () => {
    expect(coreInstallOf({ fileText: fileTextWithoutManifest, path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" })).toEqual({
      outcome: "ok",
      value: { form: "folder" },
    });
  });

  it("fails as tool-failed naming the manifest when it cannot be read", () => {
    expect(coreInstallOf({ fileText: fileTextFailingToRead, path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" })).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: `the core install's ${MANIFEST} cannot be read: EACCES` },
    });
  });

  it("fails as tool-failed naming the manifest when it is not JSON", () => {
    expect(coreInstallOf({ fileText: fileTextHolding({ text: "{ name" }), path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" })).toMatchObject({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining(`the core install's ${MANIFEST} is not JSON:`) },
    });
  });
});
