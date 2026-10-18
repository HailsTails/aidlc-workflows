import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { prepareWalkerPieces } from "./prepare-walker-pieces.ts";
import { createDefaultParsePort } from "./typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerPiece, WalkerRepository } from "./walker-piece.ts";

const PIECE_ROOT = "/install/mechanisms/walker/XX-1";
const FIRST_MODULE = "/install/mechanisms/walker/XX-1/first.ts";
const SECOND_MODULE = "/install/mechanisms/walker/XX-1/second.ts";
const ALPHA = repoPathSchema.parse("src/alpha.ts");
const BETA = repoPathSchema.parse("src/beta.ts");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;

const REPOSITORY: WalkerRepository = {
  files: [ALPHA, BETA],
  exists: () => "present",
};

const FIRST_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("XX-1#first-check"),
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: "first.ts" },
};

const SECOND_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("XX-1#second-check"),
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: "second.ts" },
};

const THIRD_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("XX-1#third-check"),
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: "first.ts" },
};

const preparedCheck = (): PreparedWalkerCheck => ({
  prepareFile: vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({
    outcome: "ok",
    value: { kind: "skipped" },
  }),
  finish: vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({
    outcome: "ok",
    value: [],
  }),
});

describe("prepareWalkerPieces", () => {
  it("loads and prepares each distinct module once with its ordered clauses and returns every prepared piece in first-module encounter order", async () => {
    const firstCheck = preparedCheck();
    const secondCheck = preparedCheck();
    const firstPreparation = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: firstCheck,
    });
    const secondPreparation = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({
      outcome: "ok",
      value: secondCheck,
    });
    const load = vi
      .fn<ModuleLoaderPort["load"]>()
      .mockResolvedValueOnce({
        outcome: "ok",
        value: { check: { prepare: firstPreparation } },
      })
      .mockResolvedValueOnce({
        outcome: "ok",
        value: { check: { prepare: secondPreparation } },
      });

    const preparation = await prepareWalkerPieces({
      selected: [
        { modulePath: FIRST_MODULE, clause: FIRST_CLAUSE },
        { modulePath: SECOND_MODULE, clause: SECOND_CLAUSE },
        { modulePath: FIRST_MODULE, clause: THIRD_CLAUSE },
      ],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "ok",
      value: [
        {
          modulePath: FIRST_MODULE,
          clauses: [FIRST_CLAUSE, THIRD_CLAUSE],
          check: {
            prepareFile: expect.any(Function),
            finish: expect.any(Function),
          },
        },
        {
          modulePath: SECOND_MODULE,
          clauses: [SECOND_CLAUSE],
          check: {
            prepareFile: expect.any(Function),
            finish: expect.any(Function),
          },
        },
      ],
    });
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledWith({ path: FIRST_MODULE });
    expect(load).toHaveBeenCalledWith({ path: SECOND_MODULE });
    expect(firstPreparation.mock.calls).toEqual([
      [
        {
          clauses: [FIRST_CLAUSE, THIRD_CLAUSE],
          repository: REPOSITORY,
          syntaxApi: SYNTAX_API,
        },
      ],
    ]);
    expect(secondPreparation.mock.calls).toEqual([
      [
        {
          clauses: [SECOND_CLAUSE],
          repository: REPOSITORY,
          syntaxApi: SYNTAX_API,
        },
      ],
    ]);
  });

  it("reports an unloadable module as piece-invalid with its piece root and loader detail", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "failed",
      error: {
        kind: "module-unloadable",
        path: FIRST_MODULE,
        detail: "SyntaxError",
      },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, clause: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: PIECE_ROOT,
        detail: "SyntaxError",
      },
    });
  });

  it.each([
    { name: "missing check export", namespace: {} },
    {
      name: "non-callable preparation",
      namespace: { check: { prepare: "prepare" } },
    },
  ])("reports a module with $name as piece-invalid", async ({ namespace }) => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: namespace,
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, clause: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-invalid",
        pieceRoot: PIECE_ROOT,
        detail: expect.any(String),
      },
    });
  });

  it("propagates a failed preparation Result without replacing its affected-input failure", async () => {
    const failedPreparation: Result<PreparedWalkerCheck, RunnerFailure> = {
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        file: ALPHA,
        detail: "EACCES",
      },
    };
    const prepare = vi.fn<WalkerPiece["prepare"]>().mockReturnValue(failedPreparation);
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: { check: { prepare } },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, clause: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: {
        kind: "file-unreadable",
        file: ALPHA,
        detail: "EACCES",
      },
    });
  });

  it("refuses a malformed prepared check returned by an otherwise callable piece", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: {
        check: {
          prepare: () => ({ outcome: "ok", value: { prepareFile: "prepareFile", finish: () => [] } }),
        },
      },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, clause: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("attributes a thrown piece preparation to that piece", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
      outcome: "ok",
      value: { check: { prepare: () => assert.fail("preparation failed") } },
    });

    const preparation = await prepareWalkerPieces({
      selected: [{ modulePath: FIRST_MODULE, clause: FIRST_CLAUSE }],
      repository: REPOSITORY,
      syntaxApi: SYNTAX_API,
      modules: { load },
    });

    expect(preparation).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "preparation failed" },
    });
  });
});
