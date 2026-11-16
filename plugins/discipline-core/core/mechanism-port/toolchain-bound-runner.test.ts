import { describe, expect, it, vi } from "vitest";
import type { EmbeddedRunner } from "./embedded-runner-module-schema.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import type { ProjectionRequest, RunRequest, RunnerClause, StandaloneRunner } from "./runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner, toolchainBoundStandaloneRunner } from "./toolchain-bound-runner.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";

type Toolchain = { readonly name: "loaded-toolchain" };

const LOADED: Result<Toolchain, RunnerFailure> = { outcome: "ok", value: { name: "loaded-toolchain" } };

const UNAVAILABLE: Result<Toolchain, RunnerFailure> = {
  outcome: "failed",
  error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.12.0 || ^10.0.0", found: "not installed" },
};

const REPO = absolutePathSchema.parse("/repo");

const CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/eslint/CD-14",
  settings: {},
};

const RUN: RunRequest = { repoRoot: REPO, installRoot: REPO, files: [], trackedPaths: [], clauses: [CLAUSE] };

const PROJECTION: ProjectionRequest = { repoRoot: REPO, installRoot: REPO, clauses: [CLAUSE], records: [] };

const standaloneOver = (): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<StandaloneRunner["run"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  conform: vi.fn<StandaloneRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const embeddedOver = (): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: vi.fn<EmbeddedRunner["run"]>().mockResolvedValue({
    outcome: "ok",
    value: { hits: [], nativeExceptions: [], projection: "current" },
  }),
  conform: vi.fn<EmbeddedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  project: vi.fn<EmbeddedRunner["project"]>().mockResolvedValue({
    outcome: "ok",
    value: { path: repoPathSchema.parse("disciplines.eslint.mjs"), effect: "written" },
  }),
});

describe("toolchainBoundStandaloneRunner", () => {
  it("builds the runner once from the loaded toolchain and delegates every run and conform to it", async () => {
    const inner = standaloneOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => StandaloneRunner>().mockReturnValue(inner);
    const bound = toolchainBoundStandaloneRunner({ toolchain: Promise.resolve(LOADED), runnerOf });
    await bound.run(RUN);
    await bound.run(RUN);
    await bound.conform({ clause: CLAUSE, cases: [] });
    expect({
      exceptionPath: bound.exceptionPath,
      toolchains: runnerOf.mock.calls,
      run: vi.mocked(inner.run).mock.calls,
      conform: vi.mocked(inner.conform).mock.calls,
    }).toEqual({
      exceptionPath: "standalone",
      toolchains: [[{ name: "loaded-toolchain" }]],
      run: [[RUN], [RUN]],
      conform: [[{ clause: CLAUSE, cases: [] }]],
    });
  });

  it("answers run and conform with the toolchain failure and never builds the runner when the toolchain is unavailable", async () => {
    const runnerOf = vi.fn<(toolchain: Toolchain) => StandaloneRunner>();
    const bound = toolchainBoundStandaloneRunner({ toolchain: Promise.resolve(UNAVAILABLE), runnerOf });
    expect({
      run: await bound.run(RUN),
      conform: await bound.conform({ clause: CLAUSE, cases: [] }),
      built: runnerOf.mock.calls.length,
    }).toEqual({ run: UNAVAILABLE, conform: UNAVAILABLE, built: 0 });
  });
});

describe("toolchainBoundEmbeddedRunner", () => {
  it("declares the projected kinds it is given and delegates run, conform and project to the runner built from the toolchain", async () => {
    const inner = embeddedOver();
    const runnerOf = vi.fn<(toolchain: Toolchain) => EmbeddedRunner>().mockReturnValue(inner);
    const bound = toolchainBoundEmbeddedRunner({
      toolchain: Promise.resolve(LOADED),
      projectedKinds: ["config-override"],
      runnerOf,
    });
    expect({
      exceptionPath: bound.exceptionPath,
      projectedKinds: bound.projectedKinds,
      run: await bound.run({ ...RUN, records: [] }),
      conform: await bound.conform({ clause: CLAUSE, cases: [] }),
      project: await bound.project(PROJECTION),
      built: runnerOf.mock.calls.length,
    }).toEqual({
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: { outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } },
      conform: { outcome: "ok", value: [] },
      project: { outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } },
      built: 1,
    });
  });

  it("answers run, conform and project with the toolchain failure when the toolchain is unavailable", async () => {
    const runnerOf = vi.fn<(toolchain: Toolchain) => EmbeddedRunner>();
    const bound = toolchainBoundEmbeddedRunner({
      toolchain: Promise.resolve(UNAVAILABLE),
      projectedKinds: ["config-override"],
      runnerOf,
    });
    expect({
      run: await bound.run({ ...RUN, records: [] }),
      conform: await bound.conform({ clause: CLAUSE, cases: [] }),
      project: await bound.project(PROJECTION),
      built: runnerOf.mock.calls.length,
    }).toEqual({ run: UNAVAILABLE, conform: UNAVAILABLE, project: UNAVAILABLE, built: 0 });
  });
});
