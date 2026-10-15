import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { LoadedRunner, RunnerClause, RunRequest } from "../mechanism-port/runner-module-schema.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { projectMechanism, runMechanism } from "./mechanism-dispatch.ts";

const WALKER = mechanismIdSchema.parse("walker");
const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");
const CLASS_SYNTAX_OBJECT = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };
const ABSTRACT_SYNTAX_OBJECT = { ruleSet: "shared", discipline: "CD-14", clause: "abstract-syntax" };

const CLASS_SYNTAX_CLAUSE: RunnerClause = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/walker/CD-14",
  settings: { module: "class-syntax.ts" },
};

const RUN_REQUEST: RunRequest = {
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  files: z.array(repoPathSchema).parse(["src/a.ts", "src/b.ts"]),
  trackedPaths: z.array(repoPathSchema).parse(["README.md", "src/a.ts", "src/b.ts"]),
  clauses: [CLASS_SYNTAX_CLAUSE],
};

const CARVE_OUT: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: WALKER,
  file: repoPathSchema.parse("src/a.ts"),
  reason: "the wrapping factory for the library",
};

const HIT_IN_A = {
  clause: CLASS_SYNTAX_OBJECT,
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const standaloneRunner = (request: { readonly run: LoadedRunner["run"] }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: request.run,
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const runResolving = (returned: unknown): LoadedRunner["run"] =>
  vi.fn<LoadedRunner["run"]>().mockResolvedValue(returned);

const dispatchRun = (request: { readonly runner: LoadedRunner }) =>
  runMechanism({ runner: request.runner, mechanism: WALKER, run: RUN_REQUEST, records: [CARVE_OUT] });

describe("runMechanism with a standalone runner", () => {
  it("returns the runner's hits with the standalone empty native values and no projection", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: [HIT_IN_A] }) }) }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "walker",
        hits: [HIT_IN_A],
        nativeExceptions: [],
        projectedKinds: [],
        projection: "none",
      },
    });
  });

  it("returns no hits when the runner flags nothing", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: [] }) }) }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "walker", hits: [], nativeExceptions: [], projectedKinds: [], projection: "none" },
    });
  });

  it("calls run once with the run request it was given", async () => {
    const run = runResolving({ outcome: "ok", value: [] });
    await dispatchRun({ runner: standaloneRunner({ run }) });
    expect(run).toHaveBeenCalledExactlyOnceWith(RUN_REQUEST);
  });

  it("passes a runner failure through unchanged", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "failed", error: { kind: "tool-failed", detail: "the parser crashed" } }),
        }),
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "tool-failed", detail: "the parser crashed" } });
  });

  it("is runner-invalid-output when run throws synchronously", async () => {
    const run = vi.fn<LoadedRunner["run"]>().mockThrow(new Error("the runner threw"));
    await expect(dispatchRun({ runner: standaloneRunner({ run }) })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output" },
    });
  });

  it("is runner-invalid-output when run rejects", async () => {
    const run = vi.fn<LoadedRunner["run"]>().mockRejectedValue(new Error("the runner rejected"));
    await expect(dispatchRun({ runner: standaloneRunner({ run }) })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output" },
    });
  });

  it("is runner-invalid-output when run returns a value that is not a result", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving([HIT_IN_A]) }) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when a hit's file is not a repo path", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: [{ ...HIT_IN_A, file: "/repo/src/a.ts" }] }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when the runner returns a failure of an unknown kind", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "failed", error: { kind: "gave-up", detail: "no" } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when a hit names a clause the request did not hold", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: [{ ...HIT_IN_A, clause: ABSTRACT_SYNTAX_OBJECT }] }),
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when a hit names a tracked file that is not in files", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: [{ ...HIT_IN_A, file: "README.md" }] }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });
});

describe("projectMechanism with a standalone runner", () => {
  it("returns no projection writes without calling run or conform", async () => {
    const runner = standaloneRunner({ run: runResolving({ outcome: "ok", value: [] }) });
    const writes = await projectMechanism({
      runner,
      request: { repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, clauses: [CLASS_SYNTAX_CLAUSE], records: [] },
    });
    expect({ writes, runCalls: vi.mocked(runner.run).mock.calls, conformCalls: vi.mocked(runner.conform).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [] },
      runCalls: [],
      conformCalls: [],
    });
  });
});
