import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause, RunRequest } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { createDefaultParsePort } from "./typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerPiece } from "./walker-piece.ts";

const PIECE_ROOT = "/install/mechanisms/audit/XX-1";
const ALPHA = repoPathSchema.parse("src/alpha.ts");
const CONFIG = repoPathSchema.parse("tsconfig.json");
const FIRST = clauseAddressSchema.parse("XX-1#first-check");
const SECOND = clauseAddressSchema.parse("XX-1#second-check");

const clauseFor = (request: { readonly address: typeof FIRST; readonly module: string }): RunnerClause => ({
  address: request.address,
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: request.module },
});

const FIRST_CLAUSE = clauseFor({ address: FIRST, module: "shared.ts" });
const SECOND_CLAUSE = clauseFor({ address: SECOND, module: "shared.ts" });

const RUN: RunRequest = {
  repoRoot: absolutePathSchema.parse("/repo"),
  installRoot: absolutePathSchema.parse("/install"),
  files: [ALPHA],
  trackedPaths: [ALPHA, CONFIG],
  clauses: [FIRST_CLAUSE, SECOND_CLAUSE],
};

const SOURCE = "const a = 1;\nlet b = 2;\n";

const fileTextOf = (request: { readonly read: FileTextPort["read"] }): FileTextPort => ({
  read: request.read,
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn<FileTextPort["write"]>(),
});

const modulesOf = (request: { readonly check: unknown }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: { check: request.check } }),
});

const LET_POSITION = 13;

const letKeywordPiece: WalkerPiece = {
  prepare: () => ({
    outcome: "ok",
    value: {
      prepareFile: vi
        .fn<PreparedWalkerCheck["prepareFile"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ anchorAt }) => ({
              finish: () => [
                { clause: FIRST, anchor: anchorAt({ position: LET_POSITION }), snippet: "let b = 2;" },
                { clause: FIRST, anchor: anchorAt({ position: 0 }), snippet: "const a = 1;" },
                { clause: SECOND, anchor: anchorAt({ position: LET_POSITION }), snippet: "let b = 2;" },
                { clause: SECOND, anchor: anchorAt({ position: 0 }), snippet: "const a = 1;" },
              ],
            }),
          },
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: { kind: "complete", hits: [{ clause: FIRST, anchor: { line: 1, column: 0 }, snippet: CONFIG }] },
        })
        .mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
      finish: () => ({
        outcome: "ok",
        value: [{ clause: SECOND, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: "repository-wide" }],
      }),
    },
  }),
};

const firstClauseLetKeywordPiece: WalkerPiece = {
  prepare: () => ({
    outcome: "ok",
    value: {
      prepareFile: vi
        .fn<PreparedWalkerCheck["prepareFile"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ anchorAt }) => ({
              finish: () => [
                { clause: FIRST, anchor: anchorAt({ position: LET_POSITION }), snippet: "let b = 2;" },
                { clause: FIRST, anchor: anchorAt({ position: 0 }), snippet: "const a = 1;" },
              ],
            }),
          },
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: { kind: "complete", hits: [{ clause: FIRST, anchor: { line: 1, column: 0 }, snippet: CONFIG }] },
        })
        .mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
      finish: () => ({
        outcome: "ok",
        value: [{ clause: SECOND, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: "repository-wide" }],
      }),
    },
  }),
};

const runnerWith = (request: { readonly fileText: FileTextPort; readonly modules: ModuleLoaderPort }) =>
  createWalkerRunner({
    fileText: request.fileText,
    modules: request.modules,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/" }),
    parse: createDefaultParsePort({}),
  });

describe("createWalkerRunner run", () => {
  it("walks every tracked path and reports each file's hits in source then clause order, then each piece's finishing hits", async () => {
    const runner = runnerWith({
      fileText: fileTextOf({ read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: SOURCE }) }),
      modules: modulesOf({ check: letKeywordPiece }),
    });

    expect(await runner.run(RUN)).toEqual({
      outcome: "ok",
      value: [
        { clause: FIRST, file: ALPHA, anchor: { line: 1, column: 0 }, snippet: "const a = 1;" },
        { clause: SECOND, file: ALPHA, anchor: { line: 1, column: 0 }, snippet: "const a = 1;" },
        { clause: FIRST, file: ALPHA, anchor: { line: 2, column: 0 }, snippet: "let b = 2;" },
        { clause: SECOND, file: ALPHA, anchor: { line: 2, column: 0 }, snippet: "let b = 2;" },
        { clause: FIRST, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: CONFIG },
        { clause: SECOND, file: CONFIG, anchor: { line: 1, column: 0 }, snippet: "repository-wide" },
      ],
    });
  });

  it("reads a file under the repository root", async () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: SOURCE });

    await runnerWith({ fileText: fileTextOf({ read }), modules: modulesOf({ check: letKeywordPiece }) }).run(RUN);

    expect(read.mock.calls).toEqual([[{ path: "/repo/src/alpha.ts" }]]);
  });

  it("loads a module two clauses share once from the piece folder and prepares it with both clauses over the tracked paths", async () => {
    const prepare = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: {
        prepareFile: vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
        finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] }),
      },
    });
    const modules = modulesOf({ check: { prepare } });

    await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules }).run(RUN);

    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: `${PIECE_ROOT}/shared.ts` });
    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        clauses: [FIRST_CLAUSE, SECOND_CLAUSE],
        repository: expect.objectContaining({ files: [ALPHA, CONFIG] }),
      }),
    );
  });

  it("is piece-invalid without loading anything when a clause's settings name a module outside its piece folder", async () => {
    const modules = modulesOf({ check: letKeywordPiece });

    const outcome = await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules }).run({
      ...RUN,
      clauses: [clauseFor({ address: FIRST, module: "../escape.ts" })],
    });

    expect(outcome).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
    expect(modules.load).not.toHaveBeenCalled();
  });

  it("is file-unreadable with the port's detail when a file a piece reads cannot be read", async () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/src/alpha.ts", detail: "denied" } });

    expect(
      await runnerWith({ fileText: fileTextOf({ read }), modules: modulesOf({ check: letKeywordPiece }) }).run(RUN),
    ).toEqual({ outcome: "failed", error: { kind: "file-unreadable", file: ALPHA, detail: "denied" } });
  });

  it("is piece-invalid when a piece's finish throws", async () => {
    const throwingPiece: WalkerPiece = {
      prepare: () => ({
        outcome: "ok",
        value: {
          prepareFile: () => ({ outcome: "ok", value: { kind: "skipped" } }),
          finish: () => assert.fail("finish broke"),
        },
      }),
    };

    expect(
      await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules: modulesOf({ check: throwingPiece }) }).run(RUN),
    ).toEqual({ outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "finish broke" } });
  });
});

describe("createWalkerRunner conform", () => {
  it("returns each case's flagged lines in case order from its own source, reading no file", async () => {
    const read = vi.fn<FileTextPort["read"]>();
    const runner = runnerWith({ fileText: fileTextOf({ read }), modules: modulesOf({ check: firstClauseLetKeywordPiece }) });

    expect(
      await runner.conform({
        clause: FIRST_CLAUSE,
        cases: [
          { name: "let on line two", fileName: ALPHA, source: SOURCE, expectedLines: [1, 2] },
          { name: "let on line one", fileName: ALPHA, source: "let b = 2;", expectedLines: [1] },
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { caseName: "let on line two", flaggedLines: [1, 2] },
        { caseName: "let on line one", flaggedLines: [1] },
      ],
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("prepares each case over a repository holding only that case's file", async () => {
    const prepare = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: {
        prepareFile: vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
        finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] }),
      },
    });

    await runnerWith({ fileText: fileTextOf({ read: vi.fn() }), modules: modulesOf({ check: { prepare } }) }).conform({
      clause: FIRST_CLAUSE,
      cases: [{ name: "config", fileName: CONFIG, source: "{}", expectedLines: [] }],
    });

    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ clauses: [FIRST_CLAUSE], repository: expect.objectContaining({ files: [CONFIG] }) }),
    );
  });
});
