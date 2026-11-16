import { resolve } from "node:path";

type Options = {
  readonly repository: string;
  readonly base: string;
  readonly candidate: string;
};

type CaseCount = {
  readonly path: string;
  readonly base: number;
  readonly candidate: number;
};

const USAGE = "usage: bun src/test-case-counts.ts --repository <checkout> --base <commit> --candidate <commit>";

const TEST_FILE = /^tests\/.*\.test\.ts$/;

const CASE_CALL = /^\s*(?:test|it)(?:\.[A-Za-z]+(?:\([^)]*\))?)*\s*[(`]/gm;

const valueOf = (argv: readonly string[], flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
};

const optionsFrom = (argv: readonly string[]): Options | undefined => {
  const repository = valueOf(argv, "--repository");
  const base = valueOf(argv, "--base");
  const candidate = valueOf(argv, "--candidate");
  if (repository === undefined || base === undefined || candidate === undefined) return undefined;
  return { repository: resolve(repository), base, candidate };
};

const gitIn = (repository: string) => (args: readonly string[]): string => {
  const run = Bun.spawnSync(["git", "-C", repository, ...args], { stdout: "pipe", stderr: "pipe" });
  if (run.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString()}`);
  return run.stdout.toString();
};

const testFilesAt = (git: (args: readonly string[]) => string, commit: string): ReadonlySet<string> =>
  new Set(git(["ls-tree", "-r", "-z", "--name-only", commit, "--", "tests"]).split("\0")
    .filter((path) => TEST_FILE.test(path)));

const casesIn = (text: string): number => [...text.matchAll(CASE_CALL)].length;

const caseCounts = (options: Options): readonly CaseCount[] => {
  const git = gitIn(options.repository);
  const atCandidate = testFilesAt(git, options.candidate);
  return [...testFilesAt(git, options.base)].filter((path) => atCandidate.has(path)).sort().map((path) => ({
    path,
    base: casesIn(git(["show", `${options.base}:${path}`])),
    candidate: casesIn(git(["show", `${options.candidate}:${path}`])),
  }));
};

const main = (argv: readonly string[]): number => {
  const options = optionsFrom(argv);
  if (options === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const counts = caseCounts(options);
  const drops = counts.filter((count) => count.candidate < count.base);
  process.stdout.write(`${counts.length} shared test files, ${drops.length} with fewer cases\n`);
  for (const drop of drops) process.stdout.write(`${drop.path}\t${drop.base}\t${drop.candidate}\n`);
  return drops.length === 0 ? 0 : 1;
};

process.exit(main(Bun.argv.slice(2)));
