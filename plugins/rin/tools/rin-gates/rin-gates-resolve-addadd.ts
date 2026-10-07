import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const fail = <E>(error: E): Result<never, E> => ({ outcome: "failed", error });

type UnmergedStage = {
  readonly stage: number;
  readonly blob: string;
};

type UnmergedPath = {
  readonly path: string;
  readonly stages: readonly UnmergedStage[];
};

type ResolveFailure =
  | { readonly reason: "not-a-repository" }
  | { readonly reason: "no-unmerged-paths" }
  | { readonly reason: "blob-unreadable"; readonly blob: string }
  | {
      readonly reason: "merge-refused";
      readonly path: string;
      readonly detail: string;
    }
  | {
      readonly reason: "stage-failed";
      readonly path: string;
      readonly detail: string;
    };

type GitRunner = (args: readonly string[]) => {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
};

const ANCESTOR_STAGE = 1;
const OURS_STAGE = 2;
const THEIRS_STAGE = 3;
const ADD_ADD_SIDE_COUNT = 2;
const SPAWN_BUFFER_BYTES = 67108864;

const spawnGit: GitRunner = (args) => {
  const run = spawnSync("git", [...args], {
    encoding: "utf-8",
    maxBuffer: SPAWN_BUFFER_BYTES,
  });
  return {
    ok: run.status === 0,
    stdout: run.stdout ?? "",
    stderr: run.stderr ?? "",
  };
};

const UNMERGED_LINE = /^(\d{6}) ([0-9a-f]{40}) ([123])\t(.+)$/;

const parseUnmergedPaths = (raw: string): readonly UnmergedPath[] => {
  const byPath = raw
    .split("\n")
    .map((line) => line.match(UNMERGED_LINE))
    .filter((matched): matched is RegExpMatchArray => matched !== null)
    .reduce<ReadonlyMap<string, readonly UnmergedStage[]>>(
      (accumulated, matched) => {
        const path = matched[4] ?? "";
        const existing = accumulated.get(path) ?? [];
        return new Map(accumulated).set(path, [
          ...existing,
          { stage: Number(matched[3]), blob: matched[2] ?? "" },
        ]);
      },
      new Map(),
    );
  return [...byPath.entries()].map(([path, stages]) => ({ path, stages }));
};

const isAddAdd = (entry: UnmergedPath): boolean =>
  entry.stages.length === ADD_ADD_SIDE_COUNT &&
  entry.stages.some((stage) => stage.stage === OURS_STAGE) &&
  entry.stages.some((stage) => stage.stage === THEIRS_STAGE) &&
  !entry.stages.some((stage) => stage.stage === ANCESTOR_STAGE);

const DECLARED_MERGE_ATTR = /:\s*merge:\s*(\S+)\s*$/;

const mergeDriverFor = (args: {
  readonly path: string;
  readonly runGit: GitRunner;
}): string | null => {
  const attr = args.runGit(["check-attr", "merge", "--", args.path]);
  if (!attr.ok) return null;
  const declared = attr.stdout.trim().match(DECLARED_MERGE_ATTR)?.[1] ?? "";
  return declared === "" || declared === "unspecified" || declared === "unset"
    ? null
    : declared;
};

const DRIVER_COMMANDS: ReadonlyMap<string, readonly string[]> = new Map([
  ["rin-audit-shard", ["rin-gates:shard-merge"]],
  ["rin-intents-registry", ["rin-gates:registry-merge"]],
]);

type ResolvedPath = {
  readonly path: string;
  readonly driver: string;
};

const stageBlobTo = (args: {
  readonly blob: string;
  readonly destination: string;
  readonly runGit: GitRunner;
}): Result<void, ResolveFailure> => {
  const shown = args.runGit(["cat-file", "blob", args.blob]);
  if (!shown.ok) return fail({ reason: "blob-unreadable", blob: args.blob });
  writeFileSync(args.destination, shown.stdout, "utf-8");
  return succeed(undefined);
};

const stageBothSides = (args: {
  readonly ours: UnmergedStage;
  readonly theirs: UnmergedStage;
  readonly sandbox: string;
  readonly runGit: GitRunner;
}): Result<
  { readonly oursPath: string; readonly theirsPath: string },
  ResolveFailure
> => {
  const oursPath = join(args.sandbox, "ours");
  const theirsPath = join(args.sandbox, "theirs");
  const stagedOurs = stageBlobTo({
    blob: args.ours.blob,
    destination: oursPath,
    runGit: args.runGit,
  });
  if (stagedOurs.outcome === "failed") return stagedOurs;
  const stagedTheirs = stageBlobTo({
    blob: args.theirs.blob,
    destination: theirsPath,
    runGit: args.runGit,
  });
  if (stagedTheirs.outcome === "failed") return stagedTheirs;
  return succeed({ oursPath, theirsPath });
};

const resolveOne = (args: {
  readonly entry: UnmergedPath;
  readonly driver: string;
  readonly sandbox: string;
  readonly runGit: GitRunner;
  readonly runMerge: (mergeArgs: readonly string[]) => {
    readonly ok: boolean;
    readonly stderr: string;
  };
}): Result<ResolvedPath, ResolveFailure> => {
  const { entry, driver, sandbox, runGit, runMerge } = args;
  const ours = entry.stages.find((stage) => stage.stage === OURS_STAGE);
  const theirs = entry.stages.find((stage) => stage.stage === THEIRS_STAGE);
  if (ours === undefined || theirs === undefined) {
    return fail({
      reason: "stage-failed",
      path: entry.path,
      detail: "missing side",
    });
  }

  const staged = stageBothSides({ ours, theirs, sandbox, runGit });
  if (staged.outcome === "failed") return staged;
  const { oursPath, theirsPath } = staged.value;

  const script = DRIVER_COMMANDS.get(driver);
  if (script === undefined) {
    return fail({
      reason: "stage-failed",
      path: entry.path,
      detail: `no command for ${driver}`,
    });
  }

  const merged = runMerge([
    ...script,
    "--ours",
    oursPath,
    "--theirs",
    theirsPath,
    "--out",
    entry.path,
  ]);
  if (!merged.ok) {
    return fail({
      reason: "merge-refused",
      path: entry.path,
      detail: merged.stderr.trim(),
    });
  }

  const added = runGit(["add", "--", entry.path]);
  return added.ok
    ? succeed({ path: entry.path, driver })
    : fail({
        reason: "stage-failed",
        path: entry.path,
        detail: added.stderr.trim(),
      });
};

const describeFailure = (failure: ResolveFailure): string => {
  switch (failure.reason) {
    case "not-a-repository":
      return "not a git repository";
    case "no-unmerged-paths":
      return "no unmerged paths — there is no conflict to resolve";
    case "blob-unreadable":
      return `cannot read conflict-side blob ${failure.blob}`;
    case "merge-refused":
      return [
        `the merge driver REFUSED ${failure.path} — the resolution was not written.`,
        `  ${failure.detail}`,
        "  This is the driver's own safety check, not a tooling failure. Resolve by hand",
        "  only after understanding why it refused.",
      ].join("\n");
    case "stage-failed":
      return `could not stage ${failure.path}: ${failure.detail}`;
  }
};

const USAGE = `rin-gates-resolve-addadd — drive the bound merge driver on add/add conflicts

  git invokes a merge driver only for THREE-WAY merges. When a file is added
  independently on both sides there is no ancestor blob, so git reports
  CONFLICT (add/add) and the driver never runs — which is the common shape for
  per-clone audit shards. This resolves those paths by handing both committed
  sides to the same driver .gitattributes already names, then staging the result.

  It resolves ONLY paths that (a) are add/add and (b) declare a known merge
  driver. Every other conflicted path is left untouched for a human.

  pnpm rin-gates:resolve-addadd [--dry-run]`;

type ResolveReport = {
  readonly resolved: readonly ResolvedPath[];
  readonly skipped: readonly string[];
};

const resolveAddAdd = (args: {
  readonly runGit: GitRunner;
  readonly runMerge: (mergeArgs: readonly string[]) => {
    readonly ok: boolean;
    readonly stderr: string;
  };
  readonly sandbox: string;
  readonly dryRun: boolean;
}): Result<ResolveReport, ResolveFailure> => {
  const unmerged = args.runGit(["ls-files", "--unmerged"]);
  if (!unmerged.ok) return fail({ reason: "not-a-repository" });
  const entries = parseUnmergedPaths(unmerged.stdout);
  if (entries.length === 0) return fail({ reason: "no-unmerged-paths" });

  const candidates = entries.map((entry) => ({
    entry,
    driver: isAddAdd(entry)
      ? mergeDriverFor({ path: entry.path, runGit: args.runGit })
      : null,
  }));

  const skipped = candidates
    .filter((candidate) => candidate.driver === null)
    .map((candidate) => candidate.entry.path);

  const actionable = candidates.filter(
    (candidate): candidate is { entry: UnmergedPath; driver: string } =>
      candidate.driver !== null,
  );

  if (args.dryRun) {
    return succeed({
      resolved: actionable.map((candidate) => ({
        path: candidate.entry.path,
        driver: candidate.driver,
      })),
      skipped,
    });
  }

  return actionable.reduce<Result<ResolveReport, ResolveFailure>>(
    (accumulated, candidate) => {
      if (accumulated.outcome === "failed") return accumulated;
      const one = resolveOne({
        entry: candidate.entry,
        driver: candidate.driver,
        sandbox: args.sandbox,
        runGit: args.runGit,
        runMerge: args.runMerge,
      });
      if (one.outcome === "failed") return one;
      return succeed({
        resolved: [...accumulated.value.resolved, one.value],
        skipped: accumulated.value.skipped,
      });
    },
    succeed({ resolved: [], skipped }),
  );
};

const spawnMerge = (
  mergeArgs: readonly string[],
): { readonly ok: boolean; readonly stderr: string } => {
  const run = spawnSync("pnpm", ["-s", ...mergeArgs], {
    encoding: "utf-8",
    maxBuffer: SPAWN_BUFFER_BYTES,
  });
  return { ok: run.status === 0, stderr: run.stderr ?? "" };
};

const runCli = (argv: readonly string[]): number => {
  if (argv.includes("--help")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const sandbox = mkdtempSync(join(tmpdir(), "rin-gates-addadd-"));
  try {
    const report = resolveAddAdd({
      runGit: spawnGit,
      runMerge: spawnMerge,
      sandbox,
      dryRun: argv.includes("--dry-run"),
    });
    if (report.outcome === "failed") {
      process.stderr.write(
        `rin-gates-resolve-addadd: ${describeFailure(report.error)}\n`,
      );
      return 1;
    }
    const verb = argv.includes("--dry-run") ? "would resolve" : "resolved";
    report.value.resolved.forEach((entry) => {
      process.stdout.write(`${verb} ${entry.path} via ${entry.driver}\n`);
    });
    report.value.skipped.forEach((path) => {
      process.stdout.write(
        `left for a human: ${path} (not add/add, or no bound driver)\n`,
      );
    });
    process.stdout.write(
      `rin-gates-resolve-addadd: ${report.value.resolved.length} ${verb}, ${report.value.skipped.length} left\n`,
    );
    return 0;
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
};

if (import.meta.main) process.exit(runCli(process.argv.slice(2)));

export type { GitRunner, ResolveFailure, ResolveReport, UnmergedPath };
export { describeFailure, isAddAdd, parseUnmergedPaths, resolveAddAdd, runCli };
