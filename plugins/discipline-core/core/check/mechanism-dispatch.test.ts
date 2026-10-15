import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { LoadedRunner, RunnerClause, RunRequest } from "../mechanism-port/runner-module-schema.ts";
import { runnerModuleSchema } from "../mechanism-port/runner-module-schema.ts";
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

const ESLINT = mechanismIdSchema.parse("eslint");

const ESLINT_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: repoPathSchema.parse("src/a.ts"),
  reason: "the wrapping factory for the library",
};

const IGNORED_B = { kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "src/b.ts" };

const PROJECTION_REQUEST = {
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  clauses: [CLASS_SYNTAX_CLAUSE],
  records: [ESLINT_LOCATION],
};

type EmbeddedCall = (request: unknown) => Promise<unknown>;

const embeddedResolving = (returned: unknown) => vi.fn<EmbeddedCall>().mockResolvedValue(returned);

const embeddedRunner = (request: { readonly run: EmbeddedCall; readonly project: EmbeddedCall }): LoadedRunner =>
  runnerModuleSchema.parse({
    exceptionPath: "embedded",
    projectedKinds: ["config-override"],
    run: request.run,
    conform: embeddedResolving({ outcome: "ok", value: [] }),
    project: request.project,
  });

const UNCALLED_PROJECT = embeddedResolving({ outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } });

const dispatchEmbeddedRun = (request: { readonly run: EmbeddedCall }) =>
  runMechanism({
    runner: embeddedRunner({ run: request.run, project: UNCALLED_PROJECT }),
    mechanism: ESLINT,
    run: RUN_REQUEST,
    records: [ESLINT_LOCATION],
  });

const UNCALLED_RUN = embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });

const dispatchEmbeddedProject = (request: { readonly project: EmbeddedCall }) =>
  projectMechanism({
    runner: embeddedRunner({ run: UNCALLED_RUN, project: request.project }),
    request: PROJECTION_REQUEST,
  });

describe("runMechanism with an embedded runner", () => {
  it("returns the report's hits, native exceptions and projection with the runner's projected kinds", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [HIT_IN_A], nativeExceptions: [IGNORED_B], projection: "current" },
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [HIT_IN_A],
        nativeExceptions: [IGNORED_B],
        projectedKinds: ["config-override"],
        projection: "current",
      },
    });
  });

  it("returns a not-included projection with its empty lists", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "not-included" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "eslint", hits: [], nativeExceptions: [], projectedKinds: ["config-override"], projection: "not-included" },
    });
  });

  it("returns a missing projection with its empty lists", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "missing" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "eslint", hits: [], nativeExceptions: [], projectedKinds: ["config-override"], projection: "missing" },
    });
  });

  it("returns an out-of-date projection beside the report's hits", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [], projection: "out-of-date" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [HIT_IN_A],
        nativeExceptions: [],
        projectedKinds: ["config-override"],
        projection: "out-of-date",
      },
    });
  });

  it("calls run once with the run request and the mechanism's records, and never calls project", async () => {
    const run = embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });
    const project = embeddedResolving({ outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } });
    await runMechanism({
      runner: embeddedRunner({ run, project }),
      mechanism: ESLINT,
      run: RUN_REQUEST,
      records: [ESLINT_LOCATION],
    });
    expect({ runCalls: run.mock.calls, projectCalls: project.mock.calls }).toEqual({
      runCalls: [[{ ...RUN_REQUEST, records: [ESLINT_LOCATION] }]],
      projectCalls: [],
    });
  });

  it("passes a runner failure through unchanged", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "failed", error: { kind: "plugin-conflict", detail: "Cannot redefine plugin" } }),
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "plugin-conflict", detail: "Cannot redefine plugin" } });
  });

  it("is runner-invalid-output when run throws synchronously", async () => {
    await expect(
      dispatchEmbeddedRun({ run: vi.fn<EmbeddedCall>().mockThrow(new Error("the runner threw")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when run rejects", async () => {
    await expect(
      dispatchEmbeddedRun({ run: vi.fn<EmbeddedCall>().mockRejectedValue(new Error("the runner rejected")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when run returns a standalone hit list instead of a report", async () => {
    await expect(
      dispatchEmbeddedRun({ run: embeddedResolving({ outcome: "ok", value: [HIT_IN_A] }) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when the report's projection is the standalone none", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "none" } }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when a native exception has an unknown kind", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: {
            hits: [],
            nativeExceptions: [{ kind: "baseline", clause: CLASS_SYNTAX_OBJECT, file: "src/b.ts" }],
            projection: "current",
          },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when a hit names a clause the request did not hold", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [{ ...HIT_IN_A, clause: ABSTRACT_SYNTAX_OBJECT }], nativeExceptions: [], projection: "current" },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when a hit names a tracked file that is not in files", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [{ ...HIT_IN_A, file: "README.md" }], nativeExceptions: [], projection: "current" },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });
});

describe("projectMechanism with an embedded runner", () => {
  it("returns the runner's one projection write as a one-entry list", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({ outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "unchanged" } }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "unchanged" }] });
  });

  it("calls project once with the projection request and never calls run", async () => {
    const run = embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });
    const project = embeddedResolving({ outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } });
    await projectMechanism({ runner: embeddedRunner({ run, project }), request: PROJECTION_REQUEST });
    expect({ projectCalls: project.mock.calls, runCalls: run.mock.calls }).toEqual({
      projectCalls: [[PROJECTION_REQUEST]],
      runCalls: [],
    });
  });

  it("passes a runner failure through unchanged", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({
          outcome: "failed",
          error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: "EACCES" },
        }),
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: "EACCES" },
    });
  });

  it("is runner-invalid-output when project throws synchronously", async () => {
    await expect(
      dispatchEmbeddedProject({ project: vi.fn<EmbeddedCall>().mockThrow(new Error("the projection threw")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when project rejects", async () => {
    await expect(
      dispatchEmbeddedProject({ project: vi.fn<EmbeddedCall>().mockRejectedValue(new Error("the projection rejected")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when the write's path is not a repo path", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({ outcome: "ok", value: { path: "/repo/disciplines.eslint.mjs", effect: "written" } }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("is runner-invalid-output when project returns a list of writes instead of one", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });
});

describe("runMechanism with an embedded runner, native exceptions against the request", () => {
  it("is runner-invalid-output when a native exception names a clause the request did not hold", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: {
            hits: [],
            nativeExceptions: [{ kind: "ignore", clause: ABSTRACT_SYNTAX_OBJECT, file: "src/b.ts" }],
            projection: "current",
          },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output" } });
  });

  it("returns a native exception whose file is not among the files under check", async () => {
    const suppression = {
      kind: "suppression-entry",
      clause: CLASS_SYNTAX_OBJECT,
      file: "src/legacy.js",
      location: "eslint-suppressions.json",
    };
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], nativeExceptions: [suppression], projection: "current" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [],
        nativeExceptions: [suppression],
        projectedKinds: ["config-override"],
        projection: "current",
      },
    });
  });
});
