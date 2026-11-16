import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { requiredEntry } from "../tests/required-entry.ts";
import type { ProofCase, StepRun } from "./install-proof-plan.ts";
import type { Result } from "../core/values/result.ts";
import type { CommandRunPort, EffectFailure, ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";
import type { TarballPackerPort } from "./package-commands.ts";
import { type InstallProofRequest, runInstallProof } from "./run-install-proof.ts";

const ENTRY_URL = "file:///package/scripts/install-proof.ts";

const README =
  "## Installing\n\n- always: `core/`\n- into the install root: `install/package.json`\n- for each selected clause in the shared rule set: `rules/<DisciplineId>/`\n\nLeave out test files (`*.test.ts`) and `tests/` folders.\n";

const PACKAGE_MANIFEST =
  '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": { "typescript-floor": "npm:typescript@4.8.4" } }';

const TOOLCHAIN_MANIFEST = '{\n  "private": true,\n  "devDependencies": {\n    "typescript": "4.8.4"\n  }\n}\n';

const CONSUMER_MANIFEST = '{\n  "private": true,\n  "type": "commonjs"\n}\n';

const PACKAGE_FILES: Readonly<Record<string, string>> = {
  "/package/README.md": README,
  "/package/package.json": PACKAGE_MANIFEST,
};

const CONSUMER = "/scratch/typescript-floor/audit";

const INSTALL = `${CONSUMER}/tools/discipline-core`;

const EXPECTING_PASS: ProofCase = {
  consumer: "audit",
  route: "copy",
  mechanism: "audit",
  toolchain: "typescript-floor",
  disciplineId: "CD-14",
  installedManifest: "kept",
  reports: { kind: "recorded" },
  actions: [{ kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } }],
};

const EXPECTING_FAIL: ProofCase = {
  ...EXPECTING_PASS,
  actions: [{ kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } }],
};

const SECOND_CONSUMER: ProofCase = { ...EXPECTING_PASS, consumer: "no-package-json" };

const PACKAGED_PASS: ProofCase = {
  ...EXPECTING_PASS,
  consumer: "audit-package",
  route: "package",
  actions: [
    { kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } },
    { kind: "project", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } },
    { kind: "read", path: "disciplines.eslint.mjs", contains: 'from "discipline-core/mechanisms/' },
  ],
};

const PACKAGED_CONSUMER = "/scratch/typescript-floor/audit-package";

const TARBALL = "/scratch/package-tarball/discipline-core-0.0.0.tgz";

const INSTALLED_PACKAGE: readonly ListedEntry[] = [
  { path: "core", name: "core", entryKind: "folder" },
  { path: "core/check/check-command.js", name: "check-command.js", entryKind: "file" },
];

const INSTALLED_PACKAGE_WITH_SOURCE: readonly ListedEntry[] = [
  ...INSTALLED_PACKAGE,
  { path: "core/check/run-check.ts", name: "run-check.ts", entryKind: "file" },
];

const PACKAGED_FILES: Readonly<Record<string, string>> = {
  ...PACKAGE_FILES,
  [`${PACKAGED_CONSUMER}/disciplines.eslint.mjs`]: 'import piece0 from "discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";\n',
};

const EXITED_PASSING: StepRun = { outcome: "exited", exitCode: 0, output: "verdict: pass" };

const EXITED_NPM_ERROR: StepRun = { outcome: "exited", exitCode: 1, output: "npm ERR! network" };

const INSTALL_WITH_A_TEST_FILE: readonly ListedEntry[] = [
  { path: "core", name: "core", entryKind: "folder" },
  { path: "core/a.ts", name: "a.ts", entryKind: "file" },
  { path: "core/a.test.ts", name: "a.test.ts", entryKind: "file" },
];

const SCRATCH_FAILURE: { readonly outcome: "failed"; readonly error: EffectFailure } = {
  outcome: "failed",
  error: { kind: "effect-failed", detail: "EBUSY: resource busy" },
};

const processPort = (): ProcessPort => ({
  arguments: [],
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const fileTextPort = (): FileTextPort => ({
  read: ({ path }) => ({ outcome: "ok", value: requiredEntry({ table: PACKAGE_FILES, key: path }) }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const scratchPort = (overrides: Partial<ScratchFilesPort>): ScratchFilesPort => ({
  createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>().mockReturnValue({ outcome: "ok", value: "/scratch" }),
  removeTree: vi.fn<ScratchFilesPort["removeTree"]>().mockReturnValue({ outcome: "ok", value: null }),
  removeFile: vi.fn<ScratchFilesPort["removeFile"]>().mockReturnValue({ outcome: "ok", value: null }),
  makeDirectory: vi.fn<ScratchFilesPort["makeDirectory"]>().mockReturnValue({ outcome: "ok", value: null }),
  copyTree: vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue({ outcome: "ok", value: null }),
  listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: [] }),
  digestOf: vi.fn<ScratchFilesPort["digestOf"]>().mockReturnValue({ outcome: "ok", value: "digest" }),
  ...overrides,
});

const packerReturning = (tarball: Result<string, string>): TarballPackerPort => ({
  pack: vi.fn<TarballPackerPort["pack"]>().mockResolvedValue(tarball),
});

const packedFileText = (): FileTextPort => ({
  read: ({ path }) => ({ outcome: "ok", value: requiredEntry({ table: PACKAGED_FILES, key: path }) }),
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const commandsReturning = (run: StepRun): CommandRunPort => ({
  run: vi.fn<CommandRunPort["run"]>().mockReturnValue(run),
});

const proofRequest = (overrides: Partial<InstallProofRequest>): InstallProofRequest => ({
  process: processPort(),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
  fileText: fileTextPort(),
  scratch: scratchPort({}),
  commands: commandsReturning(EXITED_PASSING),
  packer: packerReturning({ outcome: "ok", value: TARBALL }),
  moduleUrl: ENTRY_URL,
  proofCases: [EXPECTING_PASS],
  ...overrides,
});

const reportOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

const copiesOf = (request: { readonly scratch: ScratchFilesPort }) =>
  vi.mocked(request.scratch.copyTree).mock.calls.map(([copy]) => ({ from: copy.from, to: copy.to }));

const npmRunsOf = (request: { readonly commands: CommandRunPort }) =>
  vi.mocked(request.commands.run).mock.calls.filter(([run]) => run.command === "npm");

describe("runInstallProof", () => {
  it("exits 0 printing each ok line and the pass line when every step meets its expectation", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess }));

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit install leaves out *.test.ts, tests/\n" }],
        [{ text: 'ok: audit check -> exit 0, "verdict: pass"\n' }],
        [{ text: "install proof: pass\n" }],
      ],
      exits: [[{ code: 0 }]],
    });
  });

  it("writes the toolchain root's manifest at the peers' floors, then the consumer's commonjs manifest and its ignore file", async () => {
    const fileText = fileTextPort();

    await runInstallProof(proofRequest({ fileText }));

    expect(vi.mocked(fileText.write).mock.calls).toEqual([
      [{ path: "/scratch/typescript-floor/package.json", text: TOOLCHAIN_MANIFEST }],
      [{ path: `${CONSUMER}/package.json`, text: CONSUMER_MANIFEST }],
      [{ path: `${CONSUMER}/.gitignore`, text: "node_modules/\n" }],
    ]);
  });

  it("installs core's own packages once from the install lock, the toolchain once in its root, then runs git and the installed check in the consumer inside that root", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(proofRequest({ commands }));

    expect(vi.mocked(commands.run).mock.calls).toEqual([
      [{ command: "npm", arguments: ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], directory: "/scratch/core-packages" }],
      [{ command: "npm", arguments: ["install", "--no-audit", "--no-fund", "--ignore-scripts"], directory: "/scratch/typescript-floor" }],
      [{ command: "git", arguments: expect.arrayContaining(["init", "-q"]), directory: CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["add", "-A"]), directory: CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["commit", "-q", "-m", "consumer"]), directory: CONSUMER }],
      [
        {
          command: "node",
          arguments: [`${INSTALL}/core/check/check-command.ts`, "--repo", CONSUMER, "--base-revision", "HEAD"],
          directory: CONSUMER,
        },
      ],
    ]);
  });

  it("stages the into-root files for core's packages, then copies the fixture, the install placements and core's installed packages into the consumer", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(copiesOf({ scratch })).toEqual([
      { from: "/package/install/package.json", to: "/scratch/core-packages/package.json" },
      { from: "/package/tests/test-fixtures/consumer-proof/audit", to: CONSUMER },
      { from: "/package/core", to: `${INSTALL}/core` },
      { from: "/package/install/package.json", to: `${INSTALL}/package.json` },
      { from: "/package/rules/CD-14", to: `${INSTALL}/rules/CD-14` },
      { from: "/scratch/core-packages/node_modules", to: `${INSTALL}/node_modules` },
    ]);
  });

  it("makes the toolchain root before writing its manifest", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.makeDirectory).mock.calls).toEqual([[{ path: "/scratch/typescript-floor" }]]);
  });

  it("shares one toolchain install and one install of core's packages between consumers on the same toolchain", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(proofRequest({ commands, proofCases: [EXPECTING_PASS, SECOND_CONSUMER] }));

    expect(npmRunsOf({ commands }).map(([run]) => run.directory)).toEqual(["/scratch/core-packages", "/scratch/typescript-floor"]);
  });

  it("copies the install with a disposition that leaves out the README's excluded entries", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    const coreCopy = vi.mocked(scratch.copyTree).mock.calls.find(([copy]) => copy.to === `${INSTALL}/core`);
    expect(coreCopy?.[0].disposition({ name: "a.test.ts", entryKind: "file" })).toBe("left-out");
  });

  it("exits 1 with the FAIL line when a step's exit code does not meet its expectation", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess, proofCases: [EXPECTING_FAIL] }));

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit install leaves out *.test.ts, tests/\n" }],
        [{ text: 'FAIL: audit check: expected exit 1 and "verdict: fail", got exit 0\nverdict: pass\n' }],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("removes the temporary consumer root when a step fails", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch, proofCases: [EXPECTING_FAIL] }));

    expect(vi.mocked(scratch.removeTree).mock.calls).toEqual([[{ path: "/scratch" }]]);
  });

  it("exits 1 naming an excluded entry the copied install still holds", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        scratch: scratchPort({
          listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALL_WITH_A_TEST_FILE }),
        }),
      }),
    );

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [[{ text: "FAIL: audit install leaves out *.test.ts, tests/: found core/a.test.ts\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("lists the copied install directory for the exclusion check", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.listTree).mock.calls).toEqual([[{ path: INSTALL }]]);
  });

  it("exits 1 with the npm output when core's own packages fail to install, running nothing after it", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_NPM_ERROR);

    await runInstallProof(proofRequest({ process: proofProcess, commands }));

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls.length }).toEqual({
      report: {
        writes: [[{ text: "FAIL: npm ci core's own packages: exit 1\nnpm ERR! network\n" }]],
        exits: [[{ code: 1 }]],
      },
      runs: 1,
    });
  });

  it("exits 1 with the npm output when the toolchain install fails, running nothing after it", async () => {
    const proofProcess = processPort();
    const commands: CommandRunPort = {
      run: vi.fn<CommandRunPort["run"]>().mockReturnValueOnce(EXITED_PASSING).mockReturnValue(EXITED_NPM_ERROR),
    };

    await runInstallProof(proofRequest({ process: proofProcess, commands }));

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls.length }).toEqual({
      report: {
        writes: [[{ text: "FAIL: npm install the typescript-floor toolchain: exit 1\nnpm ERR! network\n" }]],
        exits: [[{ code: 1 }]],
      },
      runs: 2,
    });
  });

  it("removes the temporary consumer root when an install fails", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch, commands: commandsReturning(EXITED_NPM_ERROR) }));

    expect(vi.mocked(scratch.removeTree).mock.calls).toEqual([[{ path: "/scratch" }]]);
  });

  it("exits 1 when the temporary consumer root cannot be removed after the steps pass", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        scratch: scratchPort({ removeTree: vi.fn<ScratchFilesPort["removeTree"]>().mockReturnValue(SCRATCH_FAILURE) }),
      }),
    );

    expect(reportOf({ process: proofProcess }).exits).toEqual([[{ code: 1 }]]);
  });

  it("exits 1 creating nothing further when the temporary consumer root cannot be created", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands,
        scratch: scratchPort({
          createTemporaryDirectory: vi.fn<ScratchFilesPort["createTemporaryDirectory"]>().mockReturnValue(SCRATCH_FAILURE),
        }),
      }),
    );

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls }).toEqual({
      report: {
        writes: [[{ text: "FAIL: create the temporary consumer root: EBUSY: resource busy\n" }]],
        exits: [[{ code: 1 }]],
      },
      runs: [],
    });
  });

  it("packs nothing when every proof case takes the copy route", async () => {
    const packer = packerReturning({ outcome: "ok", value: TARBALL });

    await runInstallProof(proofRequest({ packer }));

    expect(vi.mocked(packer.pack).mock.calls).toEqual([]);
  });
});

describe("runInstallProof over the packaged route", () => {
  const packagedRequest = (overrides: Partial<InstallProofRequest>): InstallProofRequest =>
    proofRequest({
      fileText: packedFileText(),
      scratch: scratchPort({ listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE }) }),
      proofCases: [PACKAGED_PASS],
      ...overrides,
    });

  it("packs the package once inside the temporary root, from the package root, bundling core's own packages staged from its lock", async () => {
    const packer = packerReturning({ outcome: "ok", value: TARBALL });

    await runInstallProof(packagedRequest({ packer, proofCases: [PACKAGED_PASS, { ...PACKAGED_PASS, consumer: "second", actions: [] }] }));

    expect(vi.mocked(packer.pack).mock.calls).toEqual([
      [{ packageRoot: "/package", workRoot: "/scratch", dependencies: "/scratch/core-packages/node_modules" }],
    ]);
  });

  it("writes the consumer's commonjs manifest with scripts calling the installed bins, its ignore file, and npm config running scripts without type stripping", async () => {
    const fileText = packedFileText();

    await runInstallProof(packagedRequest({ fileText }));

    expect(vi.mocked(fileText.write).mock.calls.slice(1)).toEqual([
      [
        {
          path: `${PACKAGED_CONSUMER}/package.json`,
          text: `${JSON.stringify(
            {
              private: true,
              type: "commonjs",
              scripts: {
                "discipline:check": "discipline-core-check --repo .",
                "discipline:project": "discipline-core-project --repo .",
              },
            },
            null,
            2,
          )}\n`,
        },
      ],
      [{ path: `${PACKAGED_CONSUMER}/.gitignore`, text: "node_modules/\n" }],
      [{ path: `${PACKAGED_CONSUMER}/.npmrc`, text: "node-options=--no-experimental-strip-types\n" }],
    ]);
  });

  it("installs the packed tarball offline, then runs git and both commands through npm scripts in the consumer", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(packagedRequest({ commands }));

    expect(vi.mocked(commands.run).mock.calls.slice(2)).toEqual([
      [
        {
          command: "npm",
          arguments: ["install", "--offline", "--no-audit", "--no-fund", "--ignore-scripts", "--save-dev", TARBALL],
          directory: PACKAGED_CONSUMER,
        },
      ],
      [{ command: "git", arguments: expect.arrayContaining(["init", "-q"]), directory: PACKAGED_CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["add", "-A"]), directory: PACKAGED_CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["commit", "-q", "-m", "consumer"]), directory: PACKAGED_CONSUMER }],
      [
        {
          command: "npm",
          arguments: ["run", "--silent", "discipline:check", "--", "--base-revision", "HEAD"],
          directory: PACKAGED_CONSUMER,
        },
      ],
      [{ command: "npm", arguments: ["run", "--silent", "discipline:project"], directory: PACKAGED_CONSUMER }],
    ]);
  });

  it("copies nothing of core into the consumer: the package manager installs it", async () => {
    const scratch = scratchPort({ listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE }) });

    await runInstallProof(packagedRequest({ scratch }));

    expect(copiesOf({ scratch }).slice(1)).toEqual([
      { from: "/package/tests/test-fixtures/consumer-proof/audit", to: PACKAGED_CONSUMER },
    ]);
  });

  it("exits 0 printing that the installed package holds no TypeScript source, each command's ok line and the projection's package import", async () => {
    const proofProcess = processPort();

    await runInstallProof(packagedRequest({ process: proofProcess }));

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit-package installed package holds no TypeScript source to strip\n" }],
        [{ text: 'ok: audit-package check -> exit 0, "verdict: pass"\n' }],
        [{ text: 'ok: audit-package project -> exit 0, "verdict: pass"\n' }],
        [{ text: 'ok: audit-package disciplines.eslint.mjs holds from "discipline-core/mechanisms/\n' }],
        [{ text: "install proof: pass\n" }],
      ],
      exits: [[{ code: 0 }]],
    });
  });

  it("lists the installed package under the consumer's node_modules for the source check", async () => {
    const scratch = scratchPort({ listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE }) });

    await runInstallProof(packagedRequest({ scratch }));

    expect(vi.mocked(scratch.listTree).mock.calls).toEqual([[{ path: `${PACKAGED_CONSUMER}/node_modules/discipline-core` }]]);
  });

  it("exits 1 naming the count when the installed package holds a .ts file", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      packagedRequest({
        process: proofProcess,
        scratch: scratchPort({
          listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE_WITH_SOURCE }),
        }),
      }),
    );

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [
          {
            text: `FAIL: audit-package installed package holds no TypeScript source to strip: found 1 .ts and 1 .js files under ${PACKAGED_CONSUMER}/node_modules/discipline-core\n`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 1 with the projection text when it does not import the package's pieces by name", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      packagedRequest({
        process: proofProcess,
        proofCases: [{ ...PACKAGED_PASS, actions: [{ kind: "read", path: "disciplines.eslint.mjs", contains: "./node_modules/" }] }],
      }),
    );

    expect(reportOf({ process: proofProcess }).writes.at(-1)).toEqual([
      {
        text: `FAIL: audit-package disciplines.eslint.mjs holds ./node_modules/, but it reads\n${PACKAGED_FILES[`${PACKAGED_CONSUMER}/disciplines.eslint.mjs`]}\n`,
      },
    ]);
  });

  it("exits 1 with the packer's failure after staging core's own packages, running no consumer and removing the temporary root", async () => {
    const proofProcess = processPort();
    const scratch = scratchPort({});
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      packagedRequest({
        process: proofProcess,
        scratch,
        commands,
        packer: packerReturning({ outcome: "failed", error: "FAIL: bundle: Could not resolve" }),
      }),
    );

    expect({
      report: reportOf({ process: proofProcess }),
      runs: vi.mocked(commands.run).mock.calls,
      removed: vi.mocked(scratch.removeTree).mock.calls,
    }).toEqual({
      report: { writes: [[{ text: "FAIL: bundle: Could not resolve\n" }]], exits: [[{ code: 1 }]] },
      runs: [[{ command: "npm", arguments: ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], directory: "/scratch/core-packages" }]],
      removed: [[{ path: "/scratch" }]],
    });
  });

  describe("held to a copy-route consumer's reports", () => {
    const TWIN: ProofCase = { ...EXPECTING_PASS, actions: [EXPECTING_PASS.actions[0], EXPECTING_PASS.actions[0]] };

    const MIRROR: ProofCase = {
      ...PACKAGED_PASS,
      reports: { kind: "same-as", consumer: "audit" },
      actions: TWIN.actions,
    };

    const commandsByRoute = (request: { readonly copied: readonly string[]; readonly packaged: readonly string[] }): CommandRunPort => {
      const outputs = { node: [...request.copied], npm: [...request.packaged] };
      return {
        run: vi.fn<CommandRunPort["run"]>((run) => {
          if (run.command === "node") {
            return { outcome: "exited", exitCode: 0, output: outputs.node.shift() ?? "" };
          }
          return run.arguments[0] === "run"
            ? { outcome: "exited", exitCode: 0, output: outputs.npm.shift() ?? "" }
            : EXITED_PASSING;
        }),
      };
    };

    const mirroredRequest = (commands: CommandRunPort, proofProcess: ProcessPort): InstallProofRequest =>
      packagedRequest({
        process: proofProcess,
        commands,
        scratch: scratchPort({
          listTree: vi
            .fn<ScratchFilesPort["listTree"]>()
            .mockReturnValueOnce({ outcome: "ok", value: [] })
            .mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE }),
        }),
        proofCases: [TWIN, MIRROR],
      });

    it("passes noting each packaged report that equals the copy-route consumer's report at the same step", async () => {
      const proofProcess = processPort();
      const reports = ["findings (1)\nverdict: pass", "verdict: pass"];

      await runInstallProof(mirroredRequest(commandsByRoute({ copied: reports, packaged: reports }), proofProcess));

      expect(reportOf({ process: proofProcess }).writes.slice(-3)).toEqual([
        [{ text: 'ok: audit-package check -> exit 0, "verdict: pass", and the same report as audit\n' }],
        [{ text: 'ok: audit-package check -> exit 0, "verdict: pass", and the same report as audit\n' }],
        [{ text: "install proof: pass\n" }],
      ]);
    });

    it("fails showing both reports when a packaged report differs from the copy-route consumer's", async () => {
      const proofProcess = processPort();

      await runInstallProof(
        mirroredRequest(
          commandsByRoute({ copied: ["verdict: pass", "verdict: pass"], packaged: ["verdict: pass", "excluded (1)\nverdict: pass"] }),
          proofProcess,
        ),
      );

      expect(reportOf({ process: proofProcess })).toMatchObject({
        writes: expect.arrayContaining([
          [
            {
              text: "FAIL: audit-package check: its report differs from audit's\n--- audit\nverdict: pass\n--- audit-package check\nexcluded (1)\nverdict: pass\n",
            },
          ],
        ]),
        exits: [[{ code: 1 }]],
      });
    });

    it("fails before running a packaged consumer whose copy-route consumer was not proved first", async () => {
      const proofProcess = processPort();

      await runInstallProof(packagedRequest({ process: proofProcess, proofCases: [MIRROR] }));

      expect(reportOf({ process: proofProcess }).writes.at(-1)).toEqual([
        { text: "FAIL: audit-package: no report of audit was recorded to compare with; prove audit first\n" },
      ]);
    });
  });
});
