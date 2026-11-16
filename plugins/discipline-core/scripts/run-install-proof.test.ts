import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import type { Result } from "../core/values/result.ts";
import { requiredEntry } from "../tests/required-entry.ts";
import type { ProofCase, StepRun } from "./install-proof-plan.ts";
import type { CommandRunPort, EffectFailure, ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";
import type { TarballPackerPort } from "./package-commands.ts";
import { type InstallProofRequest, runInstallProof } from "./run-install-proof.ts";

const ENTRY_URL = "file:///package/scripts/install-proof.ts";

const PACKAGE_MANIFEST =
  '{ "peerDependencies": { "typescript": ">=4.8.4 <7.0.0" }, "devDependencies": { "typescript-floor": "npm:typescript@4.8.4" } }';

const TOOLCHAIN_MANIFEST = '{\n  "private": true,\n  "devDependencies": {\n    "typescript": "4.8.4"\n  }\n}\n';

const CONSUMER_MANIFEST = `${JSON.stringify(
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
)}\n`;

const CONSUMER = "/scratch/typescript-floor/audit";

const TARBALL = "/scratch/package-tarball/discipline-core-0.0.0.tgz";

const PROJECTION = 'import piece0 from "discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";\n';

const PACKAGE_FILES: Readonly<Record<string, string>> = {
  "/package/package.json": PACKAGE_MANIFEST,
  [`${CONSUMER}/disciplines.eslint.mjs`]: PROJECTION,
};

const EXPECTING_PASS: ProofCase = {
  consumer: "audit",
  mechanism: "audit",
  toolchain: "typescript-floor",
  actions: [
    { kind: "check", expectation: { exitCode: 0, output: "verdict: pass\n" } },
    { kind: "project", expectation: { exitCode: 0, output: "verdict: pass\n" } },
    { kind: "read", path: "disciplines.eslint.mjs", text: PROJECTION },
  ],
};

const EXPECTING_FAIL: ProofCase = {
  ...EXPECTING_PASS,
  actions: [{ kind: "check", expectation: { exitCode: 1, output: "verdict: fail\n" } }],
};

const REPORT_OF_FINDINGS = "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:0 missing co-located *.test.ts(x) sibling\nverdict: fail\n";

const EXPECTING_FINDINGS: ProofCase = {
  ...EXPECTING_PASS,
  actions: [{ kind: "check", expectation: { exitCode: 1, output: REPORT_OF_FINDINGS } }],
};

const SECOND_CONSUMER: ProofCase = { ...EXPECTING_PASS, consumer: "second", actions: [] };

const INSTALLED_PACKAGE: readonly ListedEntry[] = [
  { path: "core", name: "core", entryKind: "folder" },
  { path: "core/check/check-command.js", name: "check-command.js", entryKind: "file" },
];

const INSTALLED_PACKAGE_WITH_SOURCE: readonly ListedEntry[] = [
  ...INSTALLED_PACKAGE,
  { path: "core/check/run-check.ts", name: "run-check.ts", entryKind: "file" },
];

const EXITED_PASSING: StepRun = { outcome: "exited", exitCode: 0, output: "verdict: pass\n" };

const EXITED_NPM_ERROR: StepRun = { outcome: "exited", exitCode: 1, output: "npm ERR! network" };

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
  listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: INSTALLED_PACKAGE }),
  digestOf: vi.fn<ScratchFilesPort["digestOf"]>().mockReturnValue({ outcome: "ok", value: "digest" }),
  ...overrides,
});

const packerReturning = (tarball: Result<string, string>): TarballPackerPort => ({
  pack: vi.fn<TarballPackerPort["pack"]>().mockResolvedValue(tarball),
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

describe("runInstallProof", () => {
  it("exits 0 printing that the installed package holds no TypeScript source, each command's ok line, the projection's package import and the pass line", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess }));

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit installed package holds no TypeScript source to strip\n" }],
        [{ text: "ok: audit check -> exit 0, output exactly as expected\n" }],
        [{ text: "ok: audit project -> exit 0, output exactly as expected\n" }],
        [{ text: "ok: audit disciplines.eslint.mjs reads exactly as expected\n" }],
        [{ text: "install proof: pass\n" }],
      ],
      exits: [[{ code: 0 }]],
    });
  });

  it("packs the package once inside the temporary root, from the package root", async () => {
    const packer = packerReturning({ outcome: "ok", value: TARBALL });

    await runInstallProof(proofRequest({ packer, proofCases: [EXPECTING_PASS, SECOND_CONSUMER] }));

    expect(vi.mocked(packer.pack).mock.calls).toEqual([[{ packageRoot: "/package", workRoot: "/scratch" }]]);
  });

  it("writes the toolchain root's manifest at the peers' floors, then the consumer's manifest with scripts calling the installed bins, its ignore file and npm config running scripts without type stripping", async () => {
    const fileText = fileTextPort();

    await runInstallProof(proofRequest({ fileText }));

    expect(vi.mocked(fileText.write).mock.calls).toEqual([
      [{ path: "/scratch/typescript-floor/package.json", text: TOOLCHAIN_MANIFEST }],
      [{ path: `${CONSUMER}/package.json`, text: CONSUMER_MANIFEST }],
      [{ path: `${CONSUMER}/.gitignore`, text: "node_modules/\n" }],
      [{ path: `${CONSUMER}/.npmrc`, text: "node-options=--no-experimental-strip-types\n" }],
    ]);
  });

  it("makes the toolchain root before writing its manifest", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.makeDirectory).mock.calls).toEqual([[{ path: "/scratch/typescript-floor" }]]);
  });

  it("installs the toolchain in its root, then installs the packed tarball offline and runs git and both commands through npm scripts in the consumer", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(proofRequest({ commands }));

    expect(vi.mocked(commands.run).mock.calls).toEqual([
      [{ command: "npm", arguments: ["install", "--no-audit", "--no-fund", "--ignore-scripts"], directory: "/scratch/typescript-floor" }],
      [
        {
          command: "npm",
          arguments: ["install", "--offline", "--no-audit", "--no-fund", "--ignore-scripts", "--save-dev", TARBALL],
          directory: CONSUMER,
        },
      ],
      [{ command: "git", arguments: expect.arrayContaining(["init", "-q"]), directory: CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["add", "-A"]), directory: CONSUMER }],
      [{ command: "git", arguments: expect.arrayContaining(["commit", "-q", "-m", "consumer"]), directory: CONSUMER }],
      [{ command: "npm", arguments: ["run", "--silent", "discipline:check", "--", "--base-revision", "HEAD"], directory: CONSUMER }],
      [{ command: "npm", arguments: ["run", "--silent", "discipline:project"], directory: CONSUMER }],
    ]);
  });

  it("shares one toolchain install between consumers on the same toolchain", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(proofRequest({ commands, proofCases: [EXPECTING_PASS, SECOND_CONSUMER] }));

    expect(commands.run).toHaveBeenNthCalledWith(1, {
      command: "npm",
      arguments: ["install", "--no-audit", "--no-fund", "--ignore-scripts"],
      directory: "/scratch/typescript-floor",
    });
    expect(commands.run).toHaveBeenCalledTimes(11);
  });

  it("copies only the consumer fixture: the package manager installs core", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.copyTree).mock.calls).toEqual([
      [expect.objectContaining({ from: "/package/tests/test-fixtures/consumer-proof/audit", to: CONSUMER })],
    ]);
  });

  it("lists the installed package under the consumer's node_modules for the source check", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(vi.mocked(scratch.listTree).mock.calls).toEqual([[{ path: `${CONSUMER}/node_modules/discipline-core` }]]);
  });

  it("exits 1 naming the count when the installed package holds a .ts file", async () => {
    const proofProcess = processPort();

    await runInstallProof(
      proofRequest({
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
            text: `FAIL: audit installed package holds no TypeScript source to strip: found 1 .ts and 1 .js files under ${CONSUMER}/node_modules/discipline-core\n`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 1 showing both texts when the projection differs from the expected text", async () => {
    const proofProcess = processPort();
    const expected = 'import piece0 from "./node_modules/discipline-core/x.js";\n';

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        proofCases: [{ ...EXPECTING_PASS, actions: [{ kind: "read", path: "disciplines.eslint.mjs", text: expected }] }],
      }),
    );

    expect(proofProcess.writeOut).toHaveBeenLastCalledWith({
      text: `FAIL: audit disciplines.eslint.mjs: expected ${JSON.stringify(expected)}, but it reads ${JSON.stringify(PROJECTION)}\n`,
    });
  });

  it("exits 1 when the built package prints a report whose finding line differs, though its exit and verdict match", async () => {
    const proofProcess = processPort();
    const altered = "findings (1)\nCD-23#export-test-sibling audit src/kept.ts:1:1 missing co-located *.test.ts(x) sibling\nverdict: fail\n";

    await runInstallProof(
      proofRequest({
        process: proofProcess,
        commands: {
          run: vi
            .fn<CommandRunPort["run"]>()
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValueOnce(EXITED_PASSING)
            .mockReturnValue({ outcome: "exited", exitCode: 1, output: altered }),
        },
        proofCases: [EXPECTING_FINDINGS],
      }),
    );

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit installed package holds no TypeScript source to strip\n" }],
        [
          {
            text: `FAIL: audit check: expected exit 1 and output ${JSON.stringify(REPORT_OF_FINDINGS)}, got exit 1 and output ${JSON.stringify(altered)}\n`,
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("exits 1 with the FAIL line when a step's exit code does not meet its expectation", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess, proofCases: [EXPECTING_FAIL] }));

    expect(reportOf({ process: proofProcess })).toEqual({
      writes: [
        [{ text: "ok: audit installed package holds no TypeScript source to strip\n" }],
        [{ text: 'FAIL: audit check: expected exit 1 and output "verdict: fail\\n", got exit 0 and output "verdict: pass\\n"\n' }],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("removes the temporary consumer root when a step fails", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch, proofCases: [EXPECTING_FAIL] }));

    expect(vi.mocked(scratch.removeTree).mock.calls).toEqual([[{ path: "/scratch" }]]);
  });

  it("exits 1 with the npm output when the toolchain install fails, running nothing after it", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_NPM_ERROR);

    await runInstallProof(proofRequest({ process: proofProcess, commands }));

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls.length }).toEqual({
      report: {
        writes: [[{ text: "FAIL: npm install the typescript-floor toolchain: exit 1\nnpm ERR! network\n" }]],
        exits: [[{ code: 1 }]],
      },
      runs: 1,
    });
  });

  it("exits 1 with the packer's failure, running no consumer and removing the temporary root", async () => {
    const proofProcess = processPort();
    const scratch = scratchPort({});
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(
      proofRequest({ process: proofProcess, scratch, commands, packer: packerReturning({ outcome: "failed", error: "FAIL: bundle: Could not resolve" }) }),
    );

    expect({
      report: reportOf({ process: proofProcess }),
      runs: vi.mocked(commands.run).mock.calls,
      removed: vi.mocked(scratch.removeTree).mock.calls,
    }).toEqual({
      report: { writes: [[{ text: "FAIL: bundle: Could not resolve\n" }]], exits: [[{ code: 1 }]] },
      runs: [],
      removed: [[{ path: "/scratch" }]],
    });
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

  it("exits 1 naming the package root it cannot locate from a module URL that is not a file", async () => {
    const proofProcess = processPort();

    await runInstallProof(proofRequest({ process: proofProcess, moduleUrl: "https://example.com/install-proof.ts" }));

    expect(reportOf({ process: proofProcess }).exits).toEqual([[{ code: 1 }]]);
  });
});
