import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { type InMemoryFiles, inMemoryFiles } from "../tests/in-memory-files.ts";
import type { Bundle, BundlerPort } from "./esbuild-bundler-port.ts";
import type { StepRun } from "./install-proof-plan.ts";
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
  "/package/README.md": "# Discipline core\n",
  "/package/core/check/check-command.ts": "await run();\n",
  "/package/core/check/project-command.ts": "await project();\n",
};

const BUNDLE: Bundle = { files: [{ path: "core/check/check-command.js", text: "await run();\n" }], packageRoots: [] };

const steadyBundler = (): BundlerPort => ({ bundle: vi.fn<BundlerPort["bundle"]>().mockResolvedValue({ outcome: "ok", value: BUNDLE }) });

const driftingBundler = (): BundlerPort => ({
  bundle: vi
    .fn<BundlerPort["bundle"]>()
    .mockResolvedValueOnce({ outcome: "ok", value: BUNDLE })
    .mockResolvedValue({ outcome: "ok", value: { ...BUNDLE, files: [{ path: "core/check/check-command.js", text: "drifted\n" }] } }),
});

const packingInto = (request: { readonly files: InMemoryFiles; readonly run: StepRun }): CommandRunPort => ({
  run: vi.fn<CommandRunPort["run"]>((run) => {
    const destination = run.arguments[run.arguments.indexOf("--pack-destination") + 1];
    request.files.fileText.write({ path: `${destination}/discipline-core-0.0.0.tgz`, text: "tarball" });
    return request.run;
  }),
});

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

const EXITED: StepRun = { outcome: "exited", exitCode: 0, output: "discipline-core-0.0.0.tgz\n" };

describe("createTarballPacker", () => {
  it("builds into the work root, packs that build with npm into the work root's tarball folder, and names the one tarball", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const commands = packingInto({ files, run: EXITED });
    const packer = createTarballPacker({
      ports: { path: posixPath, fileText: files.fileText, scratch: files.scratch, bundler: steadyBundler() },
      commands,
    });

    const tarball = await packer.pack({ packageRoot: "/package", workRoot: "/work" });

    expect({ tarball, runs: vi.mocked(commands.run).mock.calls, built: files.texts()["/work/package-build/package.json"] }).toEqual({
      tarball: { outcome: "ok", value: "/work/package-tarball/discipline-core-0.0.0.tgz" },
      runs: [
        [
          {
            command: "npm",
            arguments: ["pack", "--ignore-scripts", "--pack-destination", "/work/package-tarball", "/work/package-build"],
            directory: "/package",
          },
        ],
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

    expect(await packer.pack({ packageRoot: "/package", workRoot: "/work" })).toEqual({
      outcome: "failed",
      error: 'FAIL: npm pack /work/package-build: {"outcome":"exited","exitCode":1,"output":"npm ERR! pack"}',
    });
  });
});

describe("runBuildPackage", () => {
  it("builds into the package's dist folder and prints how many files it wrote", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({ files, bundler: steadyBundler(), commands: packingInto({ files, run: EXITED }) });

    await runBuildPackage(request);

    expect(reportOf(request)).toEqual({
      writes: [[{ text: "build package: wrote 4 files to /package/dist\n" }]],
      exits: [[{ code: 0 }]],
    });
  });
});

describe("runPackPackage", () => {
  it("clears the artefacts folder, packs the dist build into it and prints the tarball", async () => {
    const files = inMemoryFiles({ initial: { ...SOURCE, "/package/artefacts/old-0.0.0.tgz": "old" } });
    const request = commandRequest({ files, bundler: steadyBundler(), commands: packingInto({ files, run: EXITED }) });

    await runPackPackage(request);

    expect({ report: reportOf(request), old: files.texts()["/package/artefacts/old-0.0.0.tgz"] }).toEqual({
      report: { writes: [[{ text: "pack package: wrote /package/artefacts/discipline-core-0.0.0.tgz\n" }]], exits: [[{ code: 0 }]] },
      old: undefined,
    });
  });
});

describe("runPackageDeterminism", () => {
  it("passes when two builds into separate temporary roots are identical, and removes the roots", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({ files, bundler: steadyBundler(), commands: packingInto({ files, run: EXITED }) });

    await runPackageDeterminism(request);

    expect({
      report: reportOf(request),
      left: Object.keys(files.texts()).filter((path) => path.startsWith("/tmp/")),
    }).toEqual({
      report: {
        writes: [[{ text: "package determinism: pass, 4 files byte-identical across two builds\n" }]],
        exits: [[{ code: 0 }]],
      },
      left: [],
    });
  });

  it("fails naming each file the two builds wrote differently", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const request = commandRequest({ files, bundler: driftingBundler(), commands: packingInto({ files, run: EXITED }) });

    await runPackageDeterminism(request);

    expect(reportOf(request)).toEqual({
      writes: [[{ text: "FAIL: package determinism: two builds differ in core/check/check-command.js\n" }]],
      exits: [[{ code: 1 }]],
    });
  });
});
