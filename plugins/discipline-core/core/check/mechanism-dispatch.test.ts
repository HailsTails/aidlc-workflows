import { describe, expect, it, vi } from "vitest";
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
const EVALUATED_A = [{ clause: CLASS_SYNTAX_OBJECT, files: ["src/a.ts"] }];
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
  trackedPaths: [repoPathSchema.parse("README.md"), repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("src/b.ts")],
  clauses: [CLASS_SYNTAX_CLAUSE],
};

const CARVE_OUT: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/mechanism-dispatch.test.ts#CARVE_OUT; not historical authorisation" },
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
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [HIT_IN_A], evaluated: EVALUATED_A } }) }) }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "walker",
        hits: [HIT_IN_A],
        evaluated: EVALUATED_A,
        nativeExceptions: [],
        projectedKinds: [],
        projection: "none",
      },
    });
  });

  it("returns no hits when the runner flags nothing", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [], evaluated: [{ clause: CLASS_SYNTAX_OBJECT, files: [] }] } }) }) }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "walker", hits: [], evaluated: [{ clause: CLASS_SYNTAX_OBJECT, files: [] }], nativeExceptions: [], projectedKinds: [], projection: "none" },
    });
  });

  it("calls run once with the run request it was given", async () => {
    const run = runResolving({ outcome: "ok", value: { hits: [], evaluated: EVALUATED_A } });
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
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner threw") },
    });
  });

  it("is runner-invalid-output when run rejects", async () => {
    const run = vi.fn<LoadedRunner["run"]>().mockRejectedValue(new Error("the runner rejected"));
    await expect(dispatchRun({ runner: standaloneRunner({ run }) })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner rejected") },
    });
  });

  it("is runner-invalid-output when run returns a value that is not a result", async () => {
    await expect(
      dispatchRun({ runner: standaloneRunner({ run: runResolving([HIT_IN_A]) }) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a hit's file is not a repo path", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, file: "/repo/src/a.ts" }], evaluated: EVALUATED_A } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("→ at value.hits[0].file") } });
  });

  it("is runner-invalid-output when the runner returns a failure of an unknown kind", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "failed", error: { kind: "gave-up", detail: "no" } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a hit names a clause the request did not hold", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({
          run: runResolving({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, clause: ABSTRACT_SYNTAX_OBJECT }], evaluated: EVALUATED_A } }),
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#abstract-syntax in src/a.ts, which the request did not hold") } });
  });

  it("is runner-invalid-output when a hit names a file outside its clause evaluation", async () => {
    await expect(
      dispatchRun({
        runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [{ ...HIT_IN_A, file: "README.md" }], evaluated: EVALUATED_A } }) }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#class-syntax in README.md, which the request did not hold") } });
  });
});

describe("runMechanism observation envelope migration", () => {
  it.each([
    { name: "missing", evaluated: [] },
    { name: "duplicate", evaluated: [
      { clause: CLASS_SYNTAX_OBJECT, files: [] },
      { clause: CLASS_SYNTAX_OBJECT, files: [] },
    ] },
  ])("refuses a $name requested evaluation even when it has no hits or eligible files", async ({ evaluated }) => {
    await expect(dispatchRun({
      runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: { hits: [], evaluated } }) }),
    })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("the requested clause CD-14#class-syntax has no single evaluation") },
    });
  });

  it("refuses an evaluation for a clause outside the requested selection", async () => {
    await expect(dispatchRun({
      runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: {
        hits: [], evaluated: [
          { clause: CLASS_SYNTAX_OBJECT, files: [] },
          { clause: ABSTRACT_SYNTAX_OBJECT, files: [] },
        ],
      } }) }),
    })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("an evaluation names CD-14#abstract-syntax, which the request did not hold") },
    });
  });

  it("refuses a hit whose file was evaluated only for another requested clause", async () => {
    await expect(runMechanism({
      runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: {
        hits: [HIT_IN_A], evaluated: [
          { clause: CLASS_SYNTAX_OBJECT, files: [] },
          { clause: ABSTRACT_SYNTAX_OBJECT, files: ["src/a.ts"] },
        ],
      } }) }),
      mechanism: WALKER,
      run: { ...RUN_REQUEST, clauses: [
        CLASS_SYNTAX_CLAUSE,
        { ...CLASS_SYNTAX_CLAUSE, address: clauseAddressSchema.parse("CD-14#abstract-syntax") },
      ] },
      records: [],
    })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#class-syntax in src/a.ts, which the request did not hold") },
    });
  });

  it("retains actual per-clause observations beyond tracked TypeScript metadata", async () => {
    const strict = clauseAddressSchema.parse("CD-3#strict");
    const hermetic = clauseAddressSchema.parse("CD-47#hermetic-git-spawns");
    const request: RunRequest = {
      ...RUN_REQUEST,
      clauses: [
        CLASS_SYNTAX_CLAUSE,
        { address: strict, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/walker/CD-3", settings: { module: "compiler-overrides.ts" } },
        { address: hermetic, anchor: { kind: "file" }, pieceRoot: "/install/mechanisms/walker/CD-47", settings: { module: "hermetic-git-spawns.ts" } },
      ],
    };
    const untrackedHit = {
      clause: CLASS_SYNTAX_OBJECT,
      file: "src/untracked.ts",
      anchor: { line: 3, column: 0 },
      snippet: "class Untracked {}",
    };
    const evaluated = [
      { clause: CLASS_SYNTAX, files: [repoPathSchema.parse("src/untracked.ts")] },
      { clause: strict, files: [repoPathSchema.parse("tsconfig.json")] },
      { clause: hermetic, files: [repoPathSchema.parse("tests/fixture.test.js")] },
    ];
    const run = runResolving({ outcome: "ok", value: { hits: [untrackedHit], evaluated } });

    await expect(runMechanism({
      runner: standaloneRunner({ run }), mechanism: WALKER, run: request, records: [],
    })).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "walker", hits: [untrackedHit], evaluated,
        nativeExceptions: [], projectedKinds: [], projection: "none",
      },
    });
    expect(run).toHaveBeenCalledExactlyOnceWith(request);
  });

  it("refuses the legacy bare hit array instead of admitting it as measured observations", async () => {
    await expect(dispatchRun({
      runner: standaloneRunner({ run: runResolving({ outcome: "ok", value: [HIT_IN_A] }) }),
    })).resolves.toMatchObject({
      outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringMatching(/\S/) },
    });
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
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/mechanism-dispatch.test.ts#ESLINT_LOCATION; not historical authorisation" },
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

const UNCALLED_RUN = embeddedResolving({ outcome: "ok", value: { hits: [], evaluated: EVALUATED_A, nativeExceptions: [], projection: "current" } });

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
          value: { hits: [HIT_IN_A], evaluated: EVALUATED_A, nativeExceptions: [IGNORED_B], projection: "current" },
        }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [HIT_IN_A],
        evaluated: EVALUATED_A,
        nativeExceptions: [IGNORED_B],
        projectedKinds: ["config-override"],
        projection: "current",
      },
    });
  });

  it("returns a not-included projection with its empty lists", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], evaluated: [], nativeExceptions: [], projection: "not-included" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "eslint", hits: [], evaluated: [], nativeExceptions: [], projectedKinds: ["config-override"], projection: "not-included" },
    });
  });

  it("returns a missing projection with its empty lists", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], evaluated: [], nativeExceptions: [], projection: "missing" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: { mechanism: "eslint", hits: [], evaluated: [], nativeExceptions: [], projectedKinds: ["config-override"], projection: "missing" },
    });
  });

  it("returns an out-of-date projection beside the report's hits", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [HIT_IN_A], evaluated: EVALUATED_A, nativeExceptions: [], projection: "out-of-date" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [HIT_IN_A],
        evaluated: EVALUATED_A,
        nativeExceptions: [],
        projectedKinds: ["config-override"],
        projection: "out-of-date",
      },
    });
  });

  it.each(["missing", "not-included"])("refuses evaluated clauses from a %s unavailable embedded mechanism", async (projection) => {
    await expect(dispatchEmbeddedRun({
      run: embeddedResolving({ outcome: "ok", value: {
        hits: [], evaluated: [{ clause: CLASS_SYNTAX_OBJECT, files: [] }], nativeExceptions: [], projection,
      } }),
    })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: expect.stringContaining("an unavailable mechanism returned evaluated clauses") },
    });
  });

  it("calls run once with the run request and the mechanism's records, and never calls project", async () => {
    const run = embeddedResolving({ outcome: "ok", value: { hits: [], evaluated: EVALUATED_A, nativeExceptions: [], projection: "current" } });
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
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner threw") } });
  });

  it("is runner-invalid-output when run rejects", async () => {
    await expect(
      dispatchEmbeddedRun({ run: vi.fn<EmbeddedCall>().mockRejectedValue(new Error("the runner rejected")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the runner rejected") } });
  });

  it("is runner-invalid-output when run returns a standalone hit list instead of a report", async () => {
    await expect(
      dispatchEmbeddedRun({ run: embeddedResolving({ outcome: "ok", value: [HIT_IN_A] }) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when the report's projection is the standalone none", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({ outcome: "ok", value: { hits: [], evaluated: EVALUATED_A, nativeExceptions: [], projection: "none" } }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a native exception has an unknown kind", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: {
            hits: [],
            evaluated: EVALUATED_A,
            nativeExceptions: [{ kind: "baseline", clause: CLASS_SYNTAX_OBJECT, file: "src/b.ts" }],
            projection: "current",
          },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
  });

  it("is runner-invalid-output when a hit names a clause the request did not hold", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [{ ...HIT_IN_A, clause: ABSTRACT_SYNTAX_OBJECT }], evaluated: EVALUATED_A, nativeExceptions: [], projection: "current" },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#abstract-syntax in src/a.ts, which the request did not hold") } });
  });

  it("is runner-invalid-output when a hit names a file outside its clause evaluation", async () => {
    await expect(
      dispatchEmbeddedRun({
        run: embeddedResolving({
          outcome: "ok",
          value: { hits: [{ ...HIT_IN_A, file: "README.md" }], evaluated: EVALUATED_A, nativeExceptions: [], projection: "current" },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a hit names CD-14#class-syntax in README.md, which the request did not hold") } });
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
    const run = embeddedResolving({ outcome: "ok", value: { hits: [], evaluated: EVALUATED_A, nativeExceptions: [], projection: "current" } });
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
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the projection threw") } });
  });

  it("is runner-invalid-output when project rejects", async () => {
    await expect(
      dispatchEmbeddedProject({ project: vi.fn<EmbeddedCall>().mockRejectedValue(new Error("the projection rejected")) }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("the runner call threw or rejected: the projection rejected") } });
  });

  it("is runner-invalid-output when the write's path is not a repo path", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({ outcome: "ok", value: { path: "/repo/disciplines.eslint.mjs", effect: "written" } }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("→ at value.path") } });
  });

  it("is runner-invalid-output when project returns a list of writes instead of one", async () => {
    await expect(
      dispatchEmbeddedProject({
        project: embeddedResolving({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("Invalid input") } });
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
            evaluated: EVALUATED_A,
            nativeExceptions: [{ kind: "ignore", clause: ABSTRACT_SYNTAX_OBJECT, file: "src/b.ts" }],
            projection: "current",
          },
        }),
      }),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid-output", detail: expect.stringContaining("a native exception names CD-14#abstract-syntax, which the request did not hold") } });
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
        run: embeddedResolving({ outcome: "ok", value: { hits: [], evaluated: EVALUATED_A, nativeExceptions: [suppression], projection: "current" } }),
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        mechanism: "eslint",
        hits: [],
        evaluated: EVALUATED_A,
        nativeExceptions: [suppression],
        projectedKinds: ["config-override"],
        projection: "current",
      },
    });
  });
});
