import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { requiredEntry } from "../tests/required-entry.ts";
import type { ProofCase, StepRun } from "./install-proof-plan.ts";
import type { CommandRunPort, EffectFailure, ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";
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
  mechanism: "audit",
  toolchain: "typescript-floor",
  disciplineId: "CD-14",
  installedManifest: "kept",
  actions: [{ kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } }],
};

const EXPECTING_FAIL: ProofCase = {
  ...EXPECTING_PASS,
  actions: [{ kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } }],
};

const SECOND_CONSUMER: ProofCase = { ...EXPECTING_PASS, consumer: "no-package-json" };

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
  ...overrides,
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
});
