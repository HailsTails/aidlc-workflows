import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { type InMemoryFiles, inMemoryFiles } from "../tests/in-memory-files.ts";
import { type NpmPacking, npmPacking } from "../tests/npm-packing.ts";
import type { Bundle, BundledOutput, BundlerPort } from "./esbuild-bundler-port.ts";
import type { CommandRunPort } from "./install-proof-ports.ts";
import {
  createTarballPacker,
  type PackageCommandRequest,
  runBuildPackage,
  runPackageDeterminism,
  runPackPackage,
} from "./package-commands.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const SOURCE: Readonly<Record<string, string>> = {
  "/package/package.json": JSON.stringify({
    version: "0.0.0",
    description: "Runs disciplines.",
    license: "MIT-0",
    private: true,
    type: "module",
    engines: { node: ">=22.18.0" },
    dependencies: {},
    peerDependencies: { typescript: ">=4.8.4 <7.0.0" },
    peerDependenciesMeta: { typescript: { optional: true } },
  }),
  "/package/tsconfig.json": "{}\n",
  "/package/install/package.json": "{}\n",
  "/package/install/package-lock.json": '{ "lockfileVersion": 3, "packages": {} }',
  "/package/README.md": "# Discipline core\n",
  "/package/core/check/check-command.ts": "await run();\n",
  "/package/core/check/project-command.ts": "await project();\n",
};

const entryOutput = (request: { readonly source: string; readonly path: string; readonly text: string }): BundledOutput => ({
  path: request.path,
  text: request.text,
  entryPoint: request.source,
  inputs: [request.source],
  externalImports: [],
});

const PROJECT_OUTPUT = entryOutput({ source: "core/check/project-command.ts", path: "core/check/project-command.js", text: "await project();\n" });

const BUNDLE: Bundle = {
  outputs: [entryOutput({ source: "core/check/check-command.ts", path: "core/check/check-command.js", text: "await run();\n" }), PROJECT_OUTPUT],
  packageRoots: [],
};

const DRIFTED: Bundle = {
  ...BUNDLE,
  outputs: [entryOutput({ source: "core/check/check-command.ts", path: "core/check/check-command.js", text: "drifted\n" }), PROJECT_OUTPUT],
};

const steadyBundler = (): BundlerPort => ({ bundle: vi.fn<BundlerPort["bundle"]>().mockResolvedValue({ outcome: "ok", value: BUNDLE }) });

const driftingBundler = (): BundlerPort => ({
  bundle: vi
    .fn<BundlerPort["bundle"]>()
    .mockResolvedValueOnce({ outcome: "ok", value: BUNDLE })
    .mockResolvedValue({ outcome: "ok", value: DRIFTED }),
});

const SAME_TARBALL = (): string => "tarball";

const NUMBERED_TARBALL = (request: { readonly packCount: number }): string => `tarball ${request.packCount}`;

const npmFaking = (request: {
  readonly files: InMemoryFiles;
  readonly tarballText: (request: { readonly packCount: number }) => string;
}): NpmPacking => npmPacking({ files: request.files, tarballName: "discipline-core-0.0.0.tgz", tarballText: request.tarballText });

const processPort = (): ProcessPort => ({
  arguments: [],
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (request: {
  readonly files: InMemoryFiles;
  readonly bundler: BundlerPort;
  readonly commands: CommandRunPort;
}): PackageCommandRequest => ({
  process: processPort(),
  path: posixPath,
  fileText: request.files.fileText,
  scratch: request.files.scratch,
  bundler: request.bundler,
  commands: request.commands,
  moduleUrl: "file:///package/scripts/build-package.ts",
});

const reportOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

const NPM_CI = ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline"];

describe("createTarballPacker", () => {
  it("builds into the work root from the given installed packages, packs that build with npm into the work root's tarball folder, and names the one tarball", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const npm = npmFaking({ files, tarballText: SAME_TARBALL });
    const packer = createTarballPacker({
      ports: { path: posixPath, fileText: files.fileText, scratch: files.scratch, bundler: steadyBundler() },
      commands: npm.commands,
    });

    const tarball = await packer.pack({ packageRoot: "/package", workRoot: "/work", dependencies: "/deps" });

    expect({ tarball, runs: npm.runs(), built: files.texts()["/work/package-build/package.json"] }).toEqual({
      tarball: { outcome: "ok", value: "/work/package-tarball/discipline-core-0.0.0.tgz" },
      runs: [
        {
          command: "npm",
          arguments: ["pack", "--ignore-scripts", "--pack-destination", "/work/package-tarball", "/work/package-build"],
          directory: "/package",
        },
      ],
      built: expect.stringContaining('"name": "discipline-core"'),
    });
  });

  it("fails with npm's output when npm pack does not succeed", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const packer = createTarballPacker({
      ports: { path: posixPath, fileText: files.fileText, scratch: files.scratch, bundler: steadyBundler() },
      commands: { run: vi.fn<CommandRunPort["run"]>().mockReturnValue({ outcome: "exited", exitCode: 1, output: "npm ERR! pack" }) },
    });

    expect(await packer.pack({ packageRoot: "/package", workRoot: "/work", dependencies: "/deps" })).toEqual({
      outcome: "failed",
      error: 'FAIL: npm pack /work/package-build: {"outcome":"exited","exitCode":1,"output":"npm ERR! pack"}',
    });
  });
});

describe("runBuildPackage", () => {
  it("installs core's own packages from its install lock into a temporary folder, builds into dist from them, and removes the folder", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const npm = npmFaking({ files, tarballText: SAME_TARBALL });
    const request = commandRequest({ files, bundler: steadyBundler(), commands: npm.commands });

    await runBuildPackage(request);

    expect({ report: reportOf(request), runs: npm.runs(), left: files.pathsUnder({ folder: "/tmp" }) }).toEqual({
      report: { writes: [[{ text: "build package: wrote 5 files to /package/dist\n" }]], exits: [[{ code: 0 }]] },
      runs: [{ command: "npm", arguments: NPM_CI, directory: "/tmp/discipline-core-package-dependencies-1" }],
      left: [],
    });
  });

  it("fails with npm's output when core's own packages do not install, building nothing", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const bundler = steadyBundler();
    const request = commandRequest({
      files,
      bundler,
      commands: { run: vi.fn<CommandRunPort["run"]>().mockReturnValue({ outcome: "exited", exitCode: 1, output: "npm ERR! network" }) },
    });

    await runBuildPackage(request);

    expect({ report: reportOf(request), bundles: vi.mocked(bundler.bundle).mock.calls.length }).toEqual({
      report: {
        writes: [
          [
            {
              text: 'FAIL: npm ci core\'s own packages from install/package-lock.json: {"outcome":"exited","exitCode":1,"output":"npm ERR! network"}\n',
            },
          ],
        ],
        exits: [[{ code: 1 }]],
      },
      bundles: 0,
    });
  });
});

describe("runPackPackage", () => {
  it("clears the artefacts folder, packs the dist build into it and prints the tarball", async () => {
    const files = inMemoryFiles({ initial: { ...SOURCE, "/package/artefacts/old-0.0.0.tgz": "old" } });
    const request = commandRequest({
      files,
      bundler: steadyBundler(),
      commands: npmFaking({ files, tarballText: SAME_TARBALL }).commands,
    });

    await runPackPackage(request);

    expect({ report: reportOf(request), old: files.texts()["/package/artefacts/old-0.0.0.tgz"] }).toEqual({
      report: { writes: [[{ text: "pack package: wrote /package/artefacts/discipline-core-0.0.0.tgz\n" }]], exits: [[{ code: 0 }]] },
      old: undefined,
    });
  });
});

describe("runPackageDeterminism", () => {
  it("passes when two builds into separate temporary roots and their packed tarballs are identical, and removes every temporary folder", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({
      files,
      bundler: steadyBundler(),
      commands: npmFaking({ files, tarballText: SAME_TARBALL }).commands,
    });

    await runPackageDeterminism(request);

    expect({ report: reportOf(request), left: files.pathsUnder({ folder: "/tmp" }) }).toEqual({
      report: {
        writes: [[{ text: "package determinism: pass, 5 files and the packed tarball byte-identical across two builds\n" }]],
        exits: [[{ code: 0 }]],
      },
      left: [],
    });
  });

  it("fails naming each file the two builds wrote differently", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({
      files,
      bundler: driftingBundler(),
      commands: npmFaking({ files, tarballText: SAME_TARBALL }).commands,
    });

    await runPackageDeterminism(request);

    expect(reportOf(request)).toEqual({
      writes: [[{ text: "FAIL: package determinism: two builds differ in core/check/check-command.js\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("fails when identical builds pack into tarballs that differ", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({
      files,
      bundler: steadyBundler(),
      commands: npmFaking({ files, tarballText: NUMBERED_TARBALL }).commands,
    });

    await runPackageDeterminism(request);

    expect(reportOf(request)).toEqual({
      writes: [[{ text: "FAIL: package determinism: the two builds' packed tarballs differ\n" }]],
      exits: [[{ code: 1 }]],
    });
  });
});
