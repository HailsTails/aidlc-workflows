import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  describeFailure,
  type GitRunner,
  isAddAdd,
  parseUnmergedPaths,
  resolveAddAdd,
  type UnmergedPath,
} from "./rin-gates-resolve-addadd";

const SHARD = "aidlc/spaces/default/intents/260724-x/audit/nightwing-abc.md";
const OURS_BLOB = "a".repeat(40);
const THEIRS_BLOB = "b".repeat(40);
const BASE_BLOB = "c".repeat(40);

const unmergedLine = (args: {
  readonly blob: string;
  readonly stage: number;
  readonly path: string;
}): string => `100644 ${args.blob} ${args.stage}\t${args.path}`;

const addAddOutput = (path: string): string =>
  [
    unmergedLine({ blob: OURS_BLOB, stage: 2, path }),
    unmergedLine({ blob: THEIRS_BLOB, stage: 3, path }),
  ].join("\n");

const gitStub = (
  responses: Readonly<Record<string, string>>,
): {
  readonly runGit: GitRunner;
  readonly calls: string[][];
} => {
  const calls: string[][] = [];
  const runGit: GitRunner = (args) => {
    calls.push([...args]);
    const key = args[0] ?? "";
    return { ok: true, stdout: responses[key] ?? "", stderr: "" };
  };
  return { runGit, calls };
};

const mergeStub = (
  ok: boolean,
): {
  readonly runMerge: (a: readonly string[]) => {
    readonly ok: boolean;
    readonly stderr: string;
  };
  readonly calls: string[][];
} => {
  const calls: string[][] = [];
  return {
    runMerge: (args) => {
      calls.push([...args]);
      return {
        ok,
        stderr: ok ? "" : "refusing to write — union invariant does not hold",
      };
    },
    calls,
  };
};

describe("parseUnmergedPaths", () => {
  test("groups the two sides of one add/add path together", () => {
    const parsed = parseUnmergedPaths(addAddOutput(SHARD));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.stages.map((stage) => stage.stage)).toEqual([2, 3]);
  });

  test("keeps a three-way conflict's ancestor stage", () => {
    const parsed = parseUnmergedPaths(
      [
        unmergedLine({ blob: BASE_BLOB, stage: 1, path: SHARD }),
        unmergedLine({ blob: OURS_BLOB, stage: 2, path: SHARD }),
        unmergedLine({ blob: THEIRS_BLOB, stage: 3, path: SHARD }),
      ].join("\n"),
    );
    expect(parsed[0]?.stages.map((stage) => stage.stage)).toEqual([1, 2, 3]);
  });

  test("separates two conflicted paths", () => {
    const parsed = parseUnmergedPaths(
      [addAddOutput(SHARD), addAddOutput("other/file.md")].join("\n"),
    );
    expect(parsed.map((entry) => entry.path)).toEqual([SHARD, "other/file.md"]);
  });

  test("ignores lines that are not unmerged entries", () => {
    expect(parseUnmergedPaths("not an entry\n")).toEqual([]);
  });
});

describe("isAddAdd", () => {
  test("accepts exactly stages 2 and 3 with no ancestor", () => {
    const entry: UnmergedPath = {
      path: SHARD,
      stages: [
        { stage: 2, blob: OURS_BLOB },
        { stage: 3, blob: THEIRS_BLOB },
      ],
    };
    expect(isAddAdd(entry)).toBe(true);
  });

  test("rejects a three-way conflict because an ancestor exists", () => {
    const entry: UnmergedPath = {
      path: SHARD,
      stages: [
        { stage: 1, blob: BASE_BLOB },
        { stage: 2, blob: OURS_BLOB },
        { stage: 3, blob: THEIRS_BLOB },
      ],
    };
    expect(isAddAdd(entry)).toBe(false);
  });

  test("rejects a delete/modify conflict carrying only one side", () => {
    const entry: UnmergedPath = {
      path: SHARD,
      stages: [
        { stage: 1, blob: BASE_BLOB },
        { stage: 2, blob: OURS_BLOB },
      ],
    };
    expect(isAddAdd(entry)).toBe(false);
  });
});

describe("resolveAddAdd", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "rin-addadd-test-"));
  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  test("plans the bound driver for an add/add shard without acting", () => {
    const { runGit } = gitStub({
      "ls-files": addAddOutput(SHARD),
      "check-attr": `${SHARD}: merge: rin-audit-shard`,
    });
    const { runMerge, calls } = mergeStub(true);
    const report = resolveAddAdd({ runGit, runMerge, sandbox, dryRun: true });
    expect(report.outcome === "ok" && report.value.resolved).toEqual([
      { path: SHARD, driver: "rin-audit-shard" },
    ]);
    expect(calls).toEqual([]);
  });

  test("hands both committed sides to the driver and stages the result", () => {
    const { runGit, calls: gitCalls } = gitStub({
      "ls-files": addAddOutput(SHARD),
      "check-attr": `${SHARD}: merge: rin-audit-shard`,
      "cat-file": "# AI-DLC Audit Log\n",
    });
    const { runMerge, calls } = mergeStub(true);
    const report = resolveAddAdd({ runGit, runMerge, sandbox, dryRun: false });
    expect(report.outcome).toBe("ok");
    expect(calls[0]?.[0]).toBe("rin-gates:shard-merge");
    expect(calls[0]).toContain("--out");
    expect(calls[0]).toContain(SHARD);
    expect(gitCalls.some((call) => call[0] === "add")).toBe(true);
  });

  test("leaves a three-way conflict for a human rather than resolving it", () => {
    const { runGit } = gitStub({
      "ls-files": [
        unmergedLine({ blob: BASE_BLOB, stage: 1, path: SHARD }),
        unmergedLine({ blob: OURS_BLOB, stage: 2, path: SHARD }),
        unmergedLine({ blob: THEIRS_BLOB, stage: 3, path: SHARD }),
      ].join("\n"),
      "check-attr": `${SHARD}: merge: rin-audit-shard`,
    });
    const { runMerge, calls } = mergeStub(true);
    const report = resolveAddAdd({ runGit, runMerge, sandbox, dryRun: false });
    expect(report.outcome === "ok" && report.value.skipped).toEqual([SHARD]);
    expect(calls).toEqual([]);
  });

  test("leaves an add/add path that declares no merge driver", () => {
    const { runGit } = gitStub({
      "ls-files": addAddOutput("src/app.ts"),
      "check-attr": "src/app.ts: merge: unspecified",
    });
    const { runMerge, calls } = mergeStub(true);
    const report = resolveAddAdd({ runGit, runMerge, sandbox, dryRun: false });
    expect(report.outcome === "ok" && report.value.skipped).toEqual([
      "src/app.ts",
    ]);
    expect(calls).toEqual([]);
  });

  test("requires the merge attribute itself, not merely a trailing token", () => {
    const { runGit } = gitStub({
      "ls-files": addAddOutput(SHARD),
      "check-attr": `${SHARD}: diff: rin-audit-shard`,
    });
    const { runMerge, calls } = mergeStub(true);
    const report = resolveAddAdd({ runGit, runMerge, sandbox, dryRun: false });
    expect(report.outcome === "ok" && report.value.skipped).toEqual([SHARD]);
    expect(calls).toEqual([]);
  });

  test("propagates the driver's refusal instead of staging a resolution", () => {
    const { runGit, calls: gitCalls } = gitStub({
      "ls-files": addAddOutput(SHARD),
      "check-attr": `${SHARD}: merge: rin-audit-shard`,
      "cat-file": "# AI-DLC Audit Log\n",
    });
    const { runMerge } = mergeStub(false);
    const report = resolveAddAdd({ runGit, runMerge, sandbox, dryRun: false });
    expect(report.outcome === "failed" && report.error.reason).toBe(
      "merge-refused",
    );
    expect(gitCalls.some((call) => call[0] === "add")).toBe(false);
  });

  test("fails when there is no conflict to resolve", () => {
    const { runGit } = gitStub({ "ls-files": "" });
    const { runMerge } = mergeStub(true);
    const report = resolveAddAdd({ runGit, runMerge, sandbox, dryRun: false });
    expect(report.outcome === "failed" && report.error.reason).toBe(
      "no-unmerged-paths",
    );
  });

  test("writes each side to the sandbox, never to the conflicted path", () => {
    const { runGit } = gitStub({
      "ls-files": addAddOutput(SHARD),
      "check-attr": `${SHARD}: merge: rin-audit-shard`,
      "cat-file": "# AI-DLC Audit Log\nSIDE\n",
    });
    const { runMerge, calls } = mergeStub(true);
    resolveAddAdd({ runGit, runMerge, sandbox, dryRun: false });
    const oursArg = calls[0]?.[calls[0].indexOf("--ours") + 1] ?? "";
    expect(oursArg.startsWith(sandbox)).toBe(true);
    expect(readFileSync(oursArg, "utf-8")).toContain("SIDE");
  });
});

describe("describeFailure", () => {
  test("names the driver's refusal as a safety check, not a tooling failure", () => {
    const described = describeFailure({
      reason: "merge-refused",
      path: SHARD,
      detail: "union invariant does not hold",
    });
    expect(described).toContain("REFUSED");
    expect(described).toContain("not a tooling failure");
  });

  test("reports an unreadable conflict side with its blob", () => {
    expect(
      describeFailure({ reason: "blob-unreadable", blob: OURS_BLOB }),
    ).toContain(OURS_BLOB);
  });
});
