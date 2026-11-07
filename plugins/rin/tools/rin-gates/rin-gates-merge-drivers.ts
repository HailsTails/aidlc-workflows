import { spawnSync } from "node:child_process";

type DriverBinding = {
  readonly name: string;
  readonly command: string;
  readonly describes: string;
};

const BINDINGS: readonly DriverBinding[] = [
  {
    name: "rin-audit-shard",
    command:
      "pnpm -s rin-gates:shard-merge --path %P --ours %A --theirs %B --out %A",
    describes: "timestamp-ordered dedup union of two audit shards",
  },
  {
    name: "rin-intents-registry",
    command:
      "pnpm -s rin-gates:registry-merge --base %O --ours %A --theirs %B --out %A",
    describes: "uuid-keyed three-way union of the intents registry",
  },
];

type GitConfigResult = { readonly ok: boolean; readonly out: string };

type ConfigRunner = (args: readonly string[]) => GitConfigResult;

type BindingOutcome = "unchanged" | "configured" | "write-failed";

const spawnGitConfig: ConfigRunner = (args) => {
  const run = spawnSync("git", ["config", ...args], { encoding: "utf-8" });
  return { ok: run.status === 0, out: (run.stdout ?? "").trim() };
};

const applyBinding = (args: {
  readonly binding: DriverBinding;
  readonly runConfig: ConfigRunner;
}): BindingOutcome => {
  const { binding, runConfig } = args;
  const existing = runConfig(["--get", `merge.${binding.name}.driver`]);
  if (existing.ok && existing.out === binding.command) return "unchanged";
  const named = runConfig([`merge.${binding.name}.name`, binding.describes]);
  const driven = runConfig([`merge.${binding.name}.driver`, binding.command]);
  return named.ok && driven.ok ? "configured" : "write-failed";
};

const applyAllBindings = (
  runConfig: ConfigRunner,
): readonly {
  readonly binding: DriverBinding;
  readonly outcome: BindingOutcome;
}[] =>
  BINDINGS.map((binding) => ({
    binding,
    outcome: applyBinding({ binding, runConfig }),
  }));

const runCli = (runConfig: ConfigRunner = spawnGitConfig): number => {
  const inRepo = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    encoding: "utf-8",
  });
  if (inRepo.status !== 0) {
    process.stderr.write("rin-gates-merge-drivers: not a git repository.\n");
    return 1;
  }
  const commonDir = (inRepo.stdout ?? "").trim();
  const outcomes = applyAllBindings(runConfig);
  outcomes.forEach((entry) => {
    process.stdout.write(
      `merge.${entry.binding.name}: ${entry.outcome} — ${entry.binding.describes}\n`,
    );
  });
  const failed = outcomes.filter((entry) => entry.outcome === "write-failed");
  if (failed.length > 0) {
    process.stderr.write(
      `rin-gates-merge-drivers: ${failed.length} binding(s) could not be written to git config — the drivers are NOT active.\n`,
    );
    return 1;
  }
  const configured = outcomes.filter((entry) => entry.outcome === "configured");
  process.stdout.write(
    `rin-gates-merge-drivers: ${configured.length} configured, ${outcomes.length - configured.length} already present (${commonDir}, shared by every worktree)\n`,
  );
  return 0;
};

if (import.meta.main) process.exit(runCli());

export type { BindingOutcome, ConfigRunner, DriverBinding, GitConfigResult };
export { applyBinding, BINDINGS, runCli };
