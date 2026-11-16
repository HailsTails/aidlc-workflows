import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { coreInstallOf } from "./core-install.ts";

const INSTALL_ROOT = absolutePathSchema.parse("/repo/node_modules/discipline-core");

const MANIFEST = "/repo/node_modules/discipline-core/package.json";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const fileTextHolding = (request: { readonly text: string }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const fileTextFailingToRead: FileTextPort = {
  read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
};

describe("coreInstallOf", () => {
  it("is the package its package.json names when built core runs, reading only that manifest", () => {
    const fileText = fileTextHolding({ text: '{ "name": "discipline-core", "type": "module" }' });

    const install = coreInstallOf({ fileText, path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" });

    expect({ install, read: vi.mocked(fileText.read).mock.calls }).toEqual({
      install: { outcome: "ok", value: { form: "package", root: INSTALL_ROOT, name: "discipline-core" } },
      read: [[{ path: MANIFEST }]],
    });
  });

  it("is a source checkout when core runs from source, reading no manifest even when one names a package", () => {
    const fileText = fileTextHolding({ text: '{ "name": "discipline-core", "type": "module" }' });

    expect({
      install: coreInstallOf({ fileText, path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".ts" }),
      read: vi.mocked(fileText.read).mock.calls,
    }).toEqual({ install: { outcome: "ok", value: { form: "source" } }, read: [] });
  });

  it("fails as tool-failed when built core's package.json names no package", () => {
    expect(
      coreInstallOf({ fileText: fileTextHolding({ text: '{ "private": true, "type": "module" }' }), path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: `the core install's ${MANIFEST} names no package` },
    });
  });

  it("fails as tool-failed naming the manifest when built core's package.json cannot be read", () => {
    expect(coreInstallOf({ fileText: fileTextFailingToRead, path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" })).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: `the core install's ${MANIFEST} cannot be read: ENOENT` },
    });
  });

  it("fails as tool-failed naming the manifest when it is not JSON", () => {
    expect(coreInstallOf({ fileText: fileTextHolding({ text: "{ name" }), path: posixPath, installRoot: INSTALL_ROOT, moduleExtension: ".js" })).toMatchObject({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining(`the core install's ${MANIFEST} is not JSON:`) },
    });
  });
});