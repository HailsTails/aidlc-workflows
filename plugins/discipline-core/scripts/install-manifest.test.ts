import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { installManifestOf, publishManifestOf, runWriteInstallManifest, writtenInstallManifest } from "./install-manifest.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const DEVELOPMENT_MANIFEST = {
  version: "0.0.0",
  private: true,
  type: "module",
  description: "Runs disciplines.",
  license: "MIT-0",
  engines: { node: ">=22.18.0" },
  scripts: { test: "vitest run" },
  dependencies: { zod: "4.4.3" },
  peerDependencies: { eslint: "^9.12.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
  peerDependenciesMeta: { eslint: { optional: true } },
  devDependencies: { vitest: "4.1.11" },
};

describe("installManifestOf", () => {
  it("keeps what an adopter's npm ci needs and drops the scripts and development dependencies", () => {
    expect(installManifestOf({ developmentManifest: JSON.stringify(DEVELOPMENT_MANIFEST) })).toEqual({
      outcome: "ok",
      value: `${JSON.stringify(
        {
          version: "0.0.0",
          private: true,
          type: "module",
          description: "Runs disciplines.",
          license: "MIT-0",
          engines: { node: ">=22.18.0" },
          dependencies: { zod: "4.4.3" },
          peerDependencies: { eslint: "^9.12.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
          peerDependenciesMeta: { eslint: { optional: true } },
        },
        null,
        2,
      )}\n`,
    });
  });

  it("names the development manifest invalid when it lacks a section the install needs", () => {
    const { dependencies: _dependencies, ...withoutDependencies } = DEVELOPMENT_MANIFEST;
    expect(installManifestOf({ developmentManifest: JSON.stringify(withoutDependencies) })).toMatchObject({
      outcome: "failed",
      error: { kind: "manifest-invalid" },
    });
  });

  it("names the development manifest invalid when it is not JSON", () => {
    expect(installManifestOf({ developmentManifest: "{" })).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("publishManifestOf", () => {
  const published = (developmentManifest: string) =>
    publishManifestOf({
      developmentManifest,
      identity: {
        name: "provisional-core",
        description: "Checks a repository against its disciplines.",
        checkBin: "provisional-check",
        projectBin: "provisional-project",
      },
      commands: { check: "core/check/check-command.js", project: "core/check/project-command.js" },
      files: ["LICENSE", "chunks", "core", "mechanisms"],
      exported: ["mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js"],
      nodeRange: "^22.13.0 || >=24",
    });

  it("names and describes the package for consumers, names its two commands, exposes only its manifest and the modules a projection imports, and carries the optional peers but no dependencies", () => {
    expect(published(JSON.stringify(DEVELOPMENT_MANIFEST))).toEqual({
      outcome: "ok",
      value: `${JSON.stringify(
        {
          name: "provisional-core",
          version: "0.0.0",
          description: "Checks a repository against its disciplines.",
          license: "MIT-0",
          type: "module",
          bin: { "provisional-check": "core/check/check-command.js", "provisional-project": "core/check/project-command.js" },
          exports: {
            "./package.json": "./package.json",
            "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js": "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js",
          },
          files: ["LICENSE", "chunks", "core", "mechanisms"],
          engines: { node: "^22.13.0 || >=24" },
          peerDependencies: { eslint: "^9.12.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
          peerDependenciesMeta: { eslint: { optional: true } },
        },
        null,
        2,
      )}\n`,
    });
  });

  it("names the development manifest invalid when it lacks the peers", () => {
    const { peerDependencies: _peers, ...withoutPeers } = DEVELOPMENT_MANIFEST;
    expect(published(JSON.stringify(withoutPeers))).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });

  it("names the development manifest invalid when it is not JSON", () => {
    expect(published("{")).toMatchObject({ outcome: "failed", error: { kind: "manifest-invalid" } });
  });
});

describe("writtenInstallManifest", () => {
  it("reads the package's development manifest and writes the install manifest beside the install lock", () => {
    const write = vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: JSON.stringify(DEVELOPMENT_MANIFEST) }),
      exists: vi.fn<FileTextPort["exists"]>(),
      write,
    };
    const written = writtenInstallManifest({ fileText, path: posixPath, packageRoot: "/core" });
    expect({ written, reads: vi.mocked(fileText.read).mock.calls, writes: write.mock.calls }).toEqual({
      written: { outcome: "ok", value: "/core/install/package.json" },
      reads: [[{ path: "/core/package.json" }]],
      writes: [[{ path: "/core/install/package.json", text: expect.stringContaining('"type": "module"') }]],
    });
  });
});

describe("runWriteInstallManifest", () => {
  it("writes the manifest for the package two folders above the script and reports the path it wrote", () => {
    const processPort: ProcessPort = { arguments: [], writeOut: vi.fn<ProcessPort["writeOut"]>(), exitWith: vi.fn<ProcessPort["exitWith"]>() };
    runWriteInstallManifest({
      process: processPort,
      path: posixPath,
      fileText: {
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: JSON.stringify(DEVELOPMENT_MANIFEST) }),
        exists: vi.fn<FileTextPort["exists"]>(),
        write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
      },
      moduleUrl: "file:///core/scripts/write-install-manifest.ts",
    });
    expect({ out: vi.mocked(processPort.writeOut).mock.calls, exit: vi.mocked(processPort.exitWith).mock.calls }).toEqual({
      out: [[{ text: "install manifest: wrote /core/install/package.json\n" }]],
      exit: [[{ code: 0 }]],
    });
  });

  it("reports the failure and exits 1 when the development manifest cannot be read", () => {
    const processPort: ProcessPort = { arguments: [], writeOut: vi.fn<ProcessPort["writeOut"]>(), exitWith: vi.fn<ProcessPort["exitWith"]>() };
    runWriteInstallManifest({
      process: processPort,
      path: posixPath,
      fileText: {
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({
          outcome: "failed",
          error: { kind: "unreadable", path: "/core/package.json", detail: "ENOENT" },
        }),
        exists: vi.fn<FileTextPort["exists"]>(),
        write: vi.fn<FileTextPort["write"]>(),
      },
      moduleUrl: "file:///core/scripts/write-install-manifest.ts",
    });
    expect({ out: vi.mocked(processPort.writeOut).mock.calls, exit: vi.mocked(processPort.exitWith).mock.calls }).toEqual({
      out: [[{ text: 'install manifest: {"kind":"unreadable","path":"/core/package.json","detail":"ENOENT"}\n' }]],
      exit: [[{ code: 1 }]],
    });
  });
});
