import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { requiredEntry } from "../tests/required-entry.ts";
import type { ProofCase, StepRun } from "./install-proof-plan.ts";
import type { CommandRunPort, EffectFailure, ListedEntry, ScratchFilesPort } from "./install-proof-ports.ts";
import { type InstallProofRequest, runInstallProof } from "./run-install-proof.ts";

const ENTRY_URL = "file:///package/scripts/install-proof.ts";

const README =
  "## Installing\n\n- always: `package.json` and `core/`\n- for each selected clause in the shared rule set: `rules/<DisciplineId>/`\n\nLeave out test files (`*.test.ts`) and `tests/` folders.\n";

const PACKAGE_MANIFEST = '{ "dependencies": { "zod": "4.4.3" } }';

const PACKAGE_FILES: Readonly<Record<string, string>> = {
  "/package/README.md": README,
  "/package/package.json": PACKAGE_MANIFEST,
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/package/scripts/install-proof.ts": "/package/scripts",
  "/package/scripts": "/package",
};

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/package","README.md"]': "/package/README.md",
  '["/package","package.json"]': "/package/package.json",
  '["/package","core"]': "/package/core",
  '["/package","rules/CD-14"]': "/package/rules/CD-14",
  '["/package","tests","test-fixtures","consumer-proof","audit"]': "/package/tests/test-fixtures/consumer-proof/audit",
  '["/scratch","package.json"]': "/scratch/package.json",
  '["/scratch","audit"]': "/scratch/audit",
  '["/scratch/audit","package.json"]': "/scratch/audit/package.json",
  '["/scratch/audit","tools","discipline-core"]': "/scratch/audit/tools/discipline-core",
  '["/scratch/audit/tools/discipline-core","package.json"]': "/scratch/audit/tools/discipline-core/package.json",
  '["/scratch/audit/tools/discipline-core","core"]': "/scratch/audit/tools/discipline-core/core",
  '["/scratch/audit/tools/discipline-core","rules/CD-14"]': "/scratch/audit/tools/discipline-core/rules/CD-14",
  '["/scratch/audit","tools","discipline-core","core","check","check-command.ts"]': "/scratch/audit/tools/discipline-core/core/check/check-command.ts",
};

const EXPECTING_PASS: ProofCase = {
  consumer: "audit",
  mechanism: "audit",
  disciplineId: "CD-14",
  installedManifest: "kept",
  actions: [{ kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } }],
};

const EXPECTING_FAIL: ProofCase = {
  ...EXPECTING_PASS,
  actions: [{ kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } }],
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

const pathPort = (): PathPort => ({
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: () => ({ outcome: "ok", value: absolutePathSchema.parse("/package/scripts/install-proof.ts") }),
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
  copyTree: vi.fn<ScratchFilesPort["copyTree"]>().mockReturnValue({ outcome: "ok", value: null }),
  listTree: vi.fn<ScratchFilesPort["listTree"]>().mockReturnValue({ outcome: "ok", value: [] }),
  ...overrides,
});

const commandsReturning = (run: StepRun): CommandRunPort => ({
  run: vi.fn<CommandRunPort["run"]>().mockReturnValue(run),
});

const proofRequest = (overrides: Partial<InstallProofRequest>): InstallProofRequest => ({
  process: processPort(),
  path: pathPort(),
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

  it("runs npm at the consumer root, then git, then the installed check with node, in that order", async () => {
    const commands = commandsReturning(EXITED_PASSING);

    await runInstallProof(proofRequest({ commands }));

    expect(vi.mocked(commands.run).mock.calls).toEqual([
      [{ command: "npm", arguments: ["install", "--no-audit", "--no-fund", "--ignore-scripts"], directory: "/scratch" }],
      [{ command: "git", arguments: expect.arrayContaining(["init", "-q"]), directory: "/scratch/audit" }],
      [{ command: "git", arguments: expect.arrayContaining(["add", "-A"]), directory: "/scratch/audit" }],
      [{ command: "git", arguments: expect.arrayContaining(["commit", "-q", "-m", "consumer"]), directory: "/scratch/audit" }],
      [
        {
          command: "node",
          arguments: ["/scratch/audit/tools/discipline-core/core/check/check-command.ts", "--repo", "/scratch/audit", "--base-revision", "HEAD"],
          directory: "/scratch/audit",
        },
      ],
    ]);
  });

  it("copies the install with a disposition that leaves out the README's excluded entries", async () => {
    const scratch = scratchPort({});

    await runInstallProof(proofRequest({ scratch }));

    expect(
      vi.mocked(scratch.copyTree).mock.calls[1][0].disposition({ name: "a.test.ts", entryKind: "file" }),
    ).toBe("left-out");
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

    expect(vi.mocked(scratch.listTree).mock.calls).toEqual([[{ path: "/scratch/audit/tools/discipline-core" }]]);
  });

  it("exits 1 with the npm output when npm install fails, running nothing after it", async () => {
    const proofProcess = processPort();
    const commands = commandsReturning(EXITED_NPM_ERROR);

    await runInstallProof(proofRequest({ process: proofProcess, commands }));

    expect({ report: reportOf({ process: proofProcess }), runs: vi.mocked(commands.run).mock.calls.length }).toEqual({
      report: {
        writes: [[{ text: "FAIL: npm install at the consumer root: exit 1\nnpm ERR! network\n" }]],
        exits: [[{ code: 1 }]],
      },
      runs: 1,
    });
  });

  it("removes the temporary consumer root when npm install fails", async () => {
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
