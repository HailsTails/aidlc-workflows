import { describe, expect, it, vi } from "vitest";
import { runCheck } from "../core/check/run-check.ts";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import * as exportTestSibling from "../mechanisms/audit/CD-23/export-test-sibling.ts";
import cd23Piece from "../mechanisms/audit/CD-23/piece.json" with { type: "json" };
import { createWalkerRunner } from "../mechanisms/audit/runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../mechanisms/audit/runner/typescript-parse.ts";
import cd23Discipline from "../rules/CD-23/discipline.json" with { type: "json" };
import * as noTmpFiles from "./probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts";
import probePiece from "./probe-rule-set/mechanisms/audit/PD-1/piece.json" with { type: "json" };
import probeDiscipline from "./probe-rule-set/rules/PD-1/discipline.json" with { type: "json" };

const TEMPORARY_SOURCE = "const scratch = 1;\n";
const UNSIBLINGED_SOURCE = "export const kept = 1;\n";
const PLAIN_SOURCE = "export const plain = 3;\n";
const PLAIN_TEST_SOURCE = 'import { plain } from "./plain.ts";\n';

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
      clauses: { "probe/PD-1#no-tmp-files": "audit", "CD-23#export-test-sibling": "audit" },
    }),
  }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/rules/CD-23/discipline.json": presentFile({ text: JSON.stringify(cd23Discipline) }),
  "/install/mechanisms/audit/CD-23/piece.json": presentFile({ text: JSON.stringify(cd23Piece) }),
  "/install/mechanisms/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/probe/rules/PD-1/discipline.json": presentFile({ text: JSON.stringify(probeDiscipline) }),
  "/repo/probe/mechanisms/audit/PD-1/piece.json": presentFile({ text: JSON.stringify(probePiece) }),
  "/repo/src/scratch.tmp.ts": presentFile({ text: TEMPORARY_SOURCE }),
  "/repo/src/kept.ts": presentFile({ text: UNSIBLINGED_SOURCE }),
  "/repo/src/plain.ts": presentFile({ text: PLAIN_SOURCE }),
  "/repo/src/plain.test.ts": presentFile({ text: PLAIN_TEST_SOURCE }),
  "/repo/README.md": presentFile({ text: "# probe\n" }),
};

const fileText: FileTextPort = {
  read: ({ path }) => FILES[path].read,
  exists: ({ path }) => FILES[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
};

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const PIECE_MODULES: Readonly<Record<string, unknown>> = {
  "/install/mechanisms/audit/CD-23/export-test-sibling.ts": exportTestSibling,
  "/repo/probe/mechanisms/audit/PD-1/no-tmp-files.ts": noTmpFiles,
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
        repoPathSchema.parse("src/plain.test.ts"),
        repoPathSchema.parse("README.md"),
      ],
    }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
};

const PROBE_ADDRESS = { ruleSet: { name: "probe" }, discipline: "PD-1", clause: "no-tmp-files" };
const EXPORT_TEST_SIBLING_ADDRESS = { ruleSet: "shared", discipline: "CD-23", clause: "export-test-sibling" };

const probeCheck = () => {
  const parse = createDefaultParsePort({});
  const parseCalls = vi.spyOn(parse, "parse");
  const runnerModule = { runner: createWalkerRunner({ fileText, modules: pieceModules, path, parse }) };
  const report = runCheck({
    repoRoot: absolutePathSchema.parse("/repo"),
    installRoot: absolutePathSchema.parse("/install"),
    baseRevision: undefined,
    fileText,
    modules: {
      load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: runnerModule }),
    },
    path,
    git,
  });
  return { report, parseCalls };
};

describe("a check selecting the probe rule set's PD-1 beside CD-23 through the audit", () => {
  it("flags the temporary file through the probe and the unit without a test sibling through CD-23 in one run", async () => {
    await expect(probeCheck().report).resolves.toEqual({
      outcome: "ok",
      value: {
        excluded: [],
        findings: [
          {
            clause: PROBE_ADDRESS,
            file: "src/scratch.tmp.ts",
            anchor: { line: 1, column: 0 },
            snippet: "src/scratch.tmp.ts",
            mechanism: "audit",
          },
          {
            clause: EXPORT_TEST_SIBLING_ADDRESS,
            file: "src/kept.ts",
            anchor: { line: 1, column: 0 },
            snippet: "missing co-located *.test.ts(x) sibling",
            mechanism: "audit",
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

  it("parses each tracked TypeScript file exactly once", async () => {
    const { report, parseCalls } = probeCheck();
    await report;
    expect(parseCalls.mock.calls).toEqual([
      [{ fileName: "src/scratch.tmp.ts", source: TEMPORARY_SOURCE }],
      [{ fileName: "src/kept.ts", source: UNSIBLINGED_SOURCE }],
      [{ fileName: "src/plain.ts", source: PLAIN_SOURCE }],
    ]);
  });
});
