import { assert, describe, expect, it, vi } from "vitest";
import { createSelectionRepository } from "../core/consumer-selection/consumer-selection.ts";
import { createExceptionRepository } from "../core/exception-records/exception-records.ts";
import { runCheck } from "../core/check/run-check.ts";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { DirectoryPort } from "../core/platform-ports/file-system-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import * as classSyntax from "../mechanisms/walker/CD-14/class-syntax.ts";
import cd14Piece from "../mechanisms/walker/CD-14/piece.json" with { type: "json" };
import { createWalkerRunner } from "../mechanisms/walker/runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../mechanisms/walker/runner/typescript-parse.ts";
import cd14Discipline from "../rules/CD-14/discipline.json" with { type: "json" };
import * as noTmpFiles from "./probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts";
import probePiece from "./probe-rule-set/mechanisms/walker/PD-1/piece.json" with { type: "json" };
import probeDiscipline from "./probe-rule-set/rules/PD-1/discipline.json" with { type: "json" };

const TEMPORARY_SOURCE = "export const scratch = 1;\n";
const CLASS_SOURCE = "export class Kept {}\n";
const PLAIN_SOURCE = "export const plain = 3;\n";

type FakeFile = {
  readonly read: ReturnType<FileTextPort["read"]>;
  readonly presence: ReturnType<FileTextPort["exists"]>;
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const FILES: Readonly<Record<string, FakeFile>> = {
  "/repo/disciplines.json": presentFile({
    text: JSON.stringify({
      version: 1,
      ruleSets: { probe: "probe" },
      clauses: { "probe/PD-1#no-tmp-files": "walker", "CD-14#class-syntax": "walker" },
    }),
  }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentFile({ text: JSON.stringify(cd14Discipline) }),
  "/install/mechanisms/walker/CD-14/piece.json": presentFile({ text: JSON.stringify(cd14Piece) }),
  "/install/mechanisms/walker/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/probe/rules/PD-1/discipline.json": presentFile({ text: JSON.stringify(probeDiscipline) }),
  "/repo/probe/mechanisms/walker/PD-1/piece.json": presentFile({ text: JSON.stringify(probePiece) }),
  "/repo/src/scratch.tmp.ts": presentFile({ text: TEMPORARY_SOURCE }),
  "/repo/src/kept.ts": presentFile({ text: CLASS_SOURCE }),
  "/repo/src/plain.ts": presentFile({ text: PLAIN_SOURCE }),
  "/repo/README.md": presentFile({ text: "# probe\n" }),
};

const fileText: FileTextPort = {
  read: ({ path }) => FILES[path].read,
  exists: ({ path }) => FILES[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
};

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const PIECE_MODULES: Readonly<Record<string, unknown>> = {
  "/install/mechanisms/walker/CD-14/class-syntax.ts": classSyntax,
  "/repo/probe/mechanisms/walker/PD-1/no-tmp-files.ts": noTmpFiles,
};

const pieceModules: ModuleLoaderPort = {
  load: ({ path: modulePath }) =>
    Promise.resolve({ outcome: "ok", value: PIECE_MODULES[modulePath] }),
};

const git: GitPort = {
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({
      outcome: "ok",
      value: [
        repoPathSchema.parse("src/scratch.tmp.ts"),
        repoPathSchema.parse("src/kept.ts"),
        repoPathSchema.parse("src/plain.ts"),
        repoPathSchema.parse("README.md"),
      ],
    }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
};

const PROBE_ADDRESS = { ruleSet: { name: "probe" }, discipline: "PD-1", clause: "no-tmp-files" };
const CLASS_SYNTAX_ADDRESS = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };

const DIRECTORY_LISTINGS: ReadonlyMap<string, ReturnType<DirectoryPort["list"]>> = new Map([
  ["/repo", { outcome: "ok", value: [
    { name: "README.md", kind: "file" }, { name: "disciplines.json", kind: "file" },
    { name: "probe", kind: "directory" }, { name: "src", kind: "directory" },
  ] }],
  ["/repo/probe", { outcome: "ok", value: [{ name: "mechanisms", kind: "directory" }, { name: "rules", kind: "directory" }] }],
  ["/repo/probe/mechanisms", { outcome: "ok", value: [{ name: "walker", kind: "directory" }] }],
  ["/repo/probe/mechanisms/walker", { outcome: "ok", value: [{ name: "PD-1", kind: "directory" }] }],
  ["/repo/probe/mechanisms/walker/PD-1", { outcome: "ok", value: [{ name: "piece.json", kind: "file" }] }],
  ["/repo/probe/rules", { outcome: "ok", value: [{ name: "PD-1", kind: "directory" }] }],
  ["/repo/probe/rules/PD-1", { outcome: "ok", value: [{ name: "discipline.json", kind: "file" }] }],
  ["/repo/src", { outcome: "ok", value: [
    { name: "kept.ts", kind: "file" }, { name: "plain.ts", kind: "file" }, { name: "scratch.tmp.ts", kind: "file" },
  ] }],
]);

const probeCheck = () => {
  const parse = createDefaultParsePort({});
  const parseCalls = vi.spyOn(parse, "parse");
  const runnerModule = { runner: createWalkerRunner({ directory: { list: ({ path }) => DIRECTORY_LISTINGS.get(path) ?? assert.fail("unexpected directory") }, fileText, modules: pieceModules, path, parse }) };
  const report = runCheck({
    repoRoot: absolutePathSchema.parse("/repo"),
    installRoot: absolutePathSchema.parse("/install"),
    baseRevision: undefined,
    selections: createSelectionRepository({ repoRoot: absolutePathSchema.parse("/repo"), installRoot: absolutePathSchema.parse("/install"), fileText, path }),
    exceptions: createExceptionRepository({ repoRoot: absolutePathSchema.parse("/repo"), fileText, path }),
    modules: {
      load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: runnerModule }),
    },
    path,
    git,
  });
  return { report, parseCalls };
};

describe("a check selecting the probe rule set's PD-1 beside CD-14 through the walker", () => {
  it("flags the temporary file through the probe and the class through CD-14 in one run", async () => {
    await expect(probeCheck().report).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [
          {
            clause: CLASS_SYNTAX_ADDRESS,
            file: "src/kept.ts",
            anchor: { line: 1, column: 7 },
            snippet: "export class Kept {}",
            mechanism: "walker",
          },
          {
            clause: PROBE_ADDRESS,
            file: "src/scratch.tmp.ts",
            anchor: { line: 1, column: 0 },
            snippet: "src/scratch.tmp.ts",
            mechanism: "walker",
          },
        ],
        exempted: [],
        uncovered: [],
        stale: [],
        forfeited: [],
        unrecorded: [],
        doublyHeld: [],
        invalidRecords: [],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });

  it("parses each eligible discovered TypeScript file exactly once", async () => {
    const { report, parseCalls } = probeCheck();
    await report;
    expect(parseCalls.mock.calls).toEqual([
      [{ fileName: "src/kept.ts", source: CLASS_SOURCE }],
      [{ fileName: "src/plain.ts", source: PLAIN_SOURCE }],
      [{ fileName: "src/scratch.tmp.ts", source: TEMPORARY_SOURCE }],
    ]);
  });
});
