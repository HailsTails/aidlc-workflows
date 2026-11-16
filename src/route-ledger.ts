import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PathClass = "retained" | "replaced" | "outside-build";

export type CommitRoute = "retained" | "replaced" | "mixed" | "outside-build";

export type Bridge = {
  readonly module: string;
  readonly readBy: string;
};

export type Scrutiny = "routine" | "dual-use" | "legacy-script" | "added in range";

export type RoutedPath = {
  readonly path: string;
  readonly kind: PathClass;
  readonly owner: string;
  readonly scrutiny: Scrutiny;
  readonly bridgedReadsTouched: readonly string[];
  readonly conflicted: boolean;
  readonly atHead: HeadState;
};

export type HeadState = "upstream bytes" | "upstream bytes plus foundation's unchanged delta" | "differs from upstream" | "absent";

export type RoutedCommit = {
  readonly sha: string;
  readonly pullRequest: string;
  readonly subject: string;
  readonly route: CommitRoute;
  readonly paths: readonly RoutedPath[];
};

export type Judgements = Readonly<Record<string, string>>;

export type Options = {
  readonly repository: string;
  readonly from: string;
  readonly to: string;
  readonly foundationBefore: string;
  readonly head: string;
  readonly bridgeMap: string;
  readonly judgements: string;
};

const THIN_ENTRIES: Readonly<Record<string, string>> = {
  "scripts/package.ts": "src/cli/package-build-root.ts and src/packaging (scripts/package.ts is a thin entry)",
  "scripts/agent-knowledge.ts": "src/projection/domain/agent-knowledge.ts (scripts/agent-knowledge.ts is a thin entry)",
};

const OUTSIDE_BUILD_PREFIXES = ["docs/", "tests/", ".github/"] as const;

const OUTSIDE_BUILD_FILES = ["CHANGELOG.md", "README.md", "zensical.toml", "AGENTS.md", "CONTRIBUTING.md"] as const;

const SHIPPED_ASSET_FOLDERS = ["hooks", "skills", "agents", "settings", "steering", "command", "plugin"] as const;

const USAGE = [
  "usage: bun src/route-ledger.ts --repository <checkout> --from <commit> --to <commit>",
  "  --foundation-before <commit> --head <commit> --bridge-map <file> --judgements <file>",
].join("\n");

const valueOf = (argv: readonly string[], flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
};

export const optionsFrom = (argv: readonly string[]): Options | undefined => {
  const values = ["--repository", "--from", "--to", "--foundation-before", "--head", "--bridge-map", "--judgements"]
    .map((flag) => valueOf(argv, flag));
  const [repository, from, to, foundationBefore, head, bridgeMap, judgements] = values;
  if (repository === undefined || from === undefined || to === undefined || foundationBefore === undefined
    || head === undefined || bridgeMap === undefined || judgements === undefined) return undefined;
  return { repository: resolve(repository), from, to, foundationBefore, head,
    bridgeMap: resolve(bridgeMap), judgements: resolve(judgements) };
};

const CONFLICTED_MERGE_EXIT = 1;

type Git = (args: readonly string[], accepted?: readonly number[]) => string;

export const gitIn = (repository: string): Git => (args, accepted = [0]) => {
  const run = Bun.spawnSync(["git", "-C", repository, ...args], { stdout: "pipe", stderr: "pipe" });
  if (!accepted.includes(run.exitCode)) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString()}`);
  return run.stdout.toString();
};

export const nulSeparated = (text: string): readonly string[] => text.split("\0").filter((entry) => entry !== "");

export const lineSeparated = (text: string): readonly string[] => text.split("\n").filter((entry) => entry !== "");

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const bridgesFrom = (file: string): readonly Bridge[] => {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
  const bridges = isRecord(parsed) ? parsed["bridges"] : undefined;
  if (!Array.isArray(bridges)) throw new Error(`${file} has no bridges list`);
  return bridges.flatMap((entry: unknown): readonly Bridge[] => {
    if (!isRecord(entry)) return [];
    const module = entry["module"];
    const readBy = entry["readBy"];
    return typeof module === "string" && typeof readBy === "string" ? [{ module, readBy }] : [];
  });
};

export const judgementsFrom = (file: string): Judgements => {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
  if (!isRecord(parsed)) throw new Error(`${file} is not an object of judgements`);
  return Object.fromEntries(Object.entries(parsed).flatMap(([sha, text]) =>
    typeof text === "string" ? [[sha, text]] : []));
};

const isOutsideBuild = (path: string): boolean =>
  OUTSIDE_BUILD_PREFIXES.some((prefix) => path.startsWith(prefix))
  || OUTSIDE_BUILD_FILES.some((file) => path === file);

const harnessOwner = (path: string): string => {
  const [, host = "", second = ""] = path.split("/");
  if (SHIPPED_ASSET_FOLDERS.some((folder) => folder === second)) return `harness/${host} shipped asset (retained)`;
  return `harness/${host} authored runtime file (retained)`;
};

const retiredOwner = (path: string): string => {
  const [, host = "", file = ""] = path.split("/");
  if (path === "biome.json") return "lint/biome-successor.ts and the monolith-lines ratchet";
  if (file === "manifest.ts") return `src/hosts/${host}/distribution.ts and host-data.ts`;
  if (file === "emit.ts") return `src/hosts/${host}/projection/`;
  if (file === "onboarding.fills.ts") return `src/hosts/${host}/onboarding-fills.ts`;
  return `src/hosts/${host}/ (retired ${file})`;
};

const retainedOwner = (path: string, bridges: readonly Bridge[]): string => {
  const readers = bridges.filter((bridge) => bridge.module === path).map((bridge) => bridge.readBy);
  if (readers.length > 0) return `${path} (retained runtime, dual-use: build reads it via ${readers.join(", ")})`;
  if (path.startsWith("harness/")) return harnessOwner(path);
  if (path.startsWith("core/")) return "core (retained runtime)";
  if (path.startsWith("plugins/")) return "plugins (retained content)";
  return `${path} (retained)`;
};

const scrutinyOf = (request: {
  readonly path: string;
  readonly added: ReadonlySet<string>;
  readonly bridges: readonly Bridge[];
}): Scrutiny => {
  if (request.bridges.some((bridge) => bridge.module === request.path)) return "dual-use";
  if (request.path.startsWith("scripts/")) return "legacy-script";
  if (request.added.has(request.path)) return "added in range";
  return "routine";
};

const routePath = (request: {
  readonly path: string;
  readonly deletedOwners: ReadonlySet<string>;
  readonly added: ReadonlySet<string>;
  readonly bridges: readonly Bridge[];
}): Pick<RoutedPath, "kind" | "owner" | "scrutiny"> => {
  const { path } = request;
  const thin = THIN_ENTRIES[path];
  if (thin !== undefined) return { kind: "replaced", owner: thin, scrutiny: "routine" };
  if (request.deletedOwners.has(path)) return { kind: "replaced", owner: retiredOwner(path), scrutiny: "routine" };
  if (isOutsideBuild(path)) return { kind: "outside-build", owner: path.split("/")[0] ?? path, scrutiny: "routine" };
  return { kind: "retained", owner: retainedOwner(path, request.bridges), scrutiny: scrutinyOf(request) };
};

const demandsJudgement = (commit: RoutedCommit): boolean =>
  commit.route === "replaced" || commit.route === "mixed"
  || commit.paths.some((path) => path.scrutiny !== "routine" || path.conflicted || path.atHead === "differs from upstream"
    || path.atHead === "absent");

const commitRoute = (paths: readonly RoutedPath[]): CommitRoute => {
  const replaced = paths.some((path) => path.kind === "replaced");
  const retained = paths.some((path) => path.kind === "retained");
  if (replaced && retained) return "mixed";
  if (replaced) return "replaced";
  if (retained) return "retained";
  return "outside-build";
};

const headState = (request: {
  readonly path: string;
  readonly presentAtHead: ReadonlySet<string>;
  readonly differsAtHead: ReadonlySet<string>;
  readonly keepsFoundationDelta: (path: string) => boolean;
}): HeadState => {
  if (!request.presentAtHead.has(request.path)) return "absent";
  if (!request.differsAtHead.has(request.path)) return "upstream bytes";
  return request.keepsFoundationDelta(request.path) ? "upstream bytes plus foundation's unchanged delta" : "differs from upstream";
};

const deltaLines = (diff: string): string =>
  lineSeparated(diff).filter((line) => (line.startsWith("+") || line.startsWith("-"))
    && !line.startsWith("+++") && !line.startsWith("---")).join("\n");

const foundationDeltaCheck = (request: { readonly git: Git; readonly options: Options }): ((path: string) => boolean) => {
  const { git, options } = request;
  const known = new Map<string, boolean>();
  return (path) => {
    const remembered = known.get(path);
    if (remembered !== undefined) return remembered;
    const kept = deltaLines(git(["diff", "--no-renames", options.from, options.foundationBefore, "--", path]))
      === deltaLines(git(["diff", "--no-renames", options.to, options.head, "--", path]));
    known.set(path, kept);
    return kept;
  };
};

const IMPORT_CLAUSE = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g;

const importedNames = (source: string, module: string): readonly string[] =>
  [...source.matchAll(IMPORT_CLAUSE)]
    .filter((match) => (match[2] ?? "").endsWith(module))
    .flatMap((match) => (match[1] ?? "").split(","))
    .map((entry) => entry.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0] ?? "")
    .filter((name) => name !== "");

const changedText = (diff: string): string =>
  lineSeparated(diff).filter((line) => line.startsWith("@@")
    || ((line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---")))
    .join("\n");

const mentions = (text: string, name: string): boolean =>
  new RegExp(`(^|[^A-Za-z0-9_$])${name.replaceAll("$", "\\$")}([^A-Za-z0-9_$]|$)`, "m").test(text);

const bridgedReadsTouchedBy = (request: {
  readonly git: Git;
  readonly head: string;
  readonly bridges: readonly Bridge[];
  readonly sha: string;
  readonly path: string;
}): readonly string[] => {
  const readers = request.bridges.filter((bridge) => bridge.module === request.path);
  if (readers.length === 0) return [];
  const changed = changedText(request.git(["show", "-U0", "--no-renames", "--format=", request.sha, "--", request.path]));
  return readers.flatMap((bridge) => {
    const names = importedNames(request.git(["show", `${request.head}:${bridge.readBy}`]), request.path);
    if (names.length === 0) return [`no named import, so the whole module (${bridge.readBy} loads, runs or type-checks against it)`];
    return names.filter((name) => mentions(changed, name)).map((name) => `${name} (${bridge.readBy})`);
  });
};

export const routedCommits = (options: Options): readonly RoutedCommit[] => {
  const git = gitIn(options.repository);
  const bridges = bridgesFrom(options.bridgeMap);
  const atFrom = new Set(nulSeparated(git(["ls-tree", "-r", "-z", "--name-only", options.from])));
  const atFoundation = new Set(nulSeparated(git(["ls-tree", "-r", "-z", "--name-only", options.foundationBefore])));
  const deletedOwners = new Set([...atFrom].filter((path) => !atFoundation.has(path)));
  const presentAtHead = new Set(nulSeparated(git(["ls-tree", "-r", "-z", "--name-only", options.head])));
  const added = new Set(nulSeparated(git(["diff", "-z", "--no-renames", "--diff-filter=A", "--name-only",
    options.from, options.to])));
  const differsAtHead = new Set(nulSeparated(git(["diff", "-z", "--no-renames", "--name-only", options.to, options.head])));
  const merged = lineSeparated(git(["merge-tree", "--write-tree", "--name-only", "--no-messages", "-X", "no-renames",
    options.foundationBefore, options.to], [0, CONFLICTED_MERGE_EXIT]));
  const conflicted = new Set(merged.slice(1));
  const keepsFoundationDelta = foundationDeltaCheck({ git, options });
  const log = nulSeparated(git(["log", "--reverse", "-z", "--format=%h%x09%s", `${options.from}..${options.to}`]));
  return log.map((line) => {
    const [sha = "", subject = ""] = line.split("\t");
    const pullRequest = /\(#(\d+)\)\s*$/.exec(subject)?.[1];
    const touched = nulSeparated(git(["show", "-z", "--no-renames", "--format=", "--name-only", sha]));
    const paths = touched.map((path): RoutedPath => ({
      path, ...routePath({ path, deletedOwners, added, bridges }),
      bridgedReadsTouched: bridgedReadsTouchedBy({ git, head: options.head, bridges, sha, path }),
      conflicted: conflicted.has(path),
      atHead: headState({ path, presentAtHead, differsAtHead, keepsFoundationDelta }),
    }));
    return { sha, pullRequest: pullRequest === undefined ? "-" : `#${pullRequest}`,
      subject: subject.replace(/\s*\(#\d+\)\s*$/, ""), route: commitRoute(paths), paths };
  });
};

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

const pathLine = (path: RoutedPath): string => [
  `\`${path.path}\`: ${path.kind}; ${path.owner}; `,
  path.scrutiny === "routine" ? "" : `${path.scrutiny}; `,
  path.scrutiny === "dual-use" ? `bridged reads touched: ${path.bridgedReadsTouched.join(", ") || "none"}; ` : "",
  path.conflicted ? "conflicted; " : "",
  `at head ${path.atHead}`,
].join("");

const landingOf = (commit: RoutedCommit, judgements: Judgements): string => {
  const judged = judgements[commit.sha];
  if (judged !== undefined) return judged;
  if (demandsJudgement(commit)) return "UNJUDGED";
  const where = commit.route === "outside-build" ? "outside the build" : "in its retained owner";
  return commit.paths.some((path) => path.atHead === "upstream bytes plus foundation's unchanged delta")
    ? `Landed as upstream bytes ${where}; where foundation already changed a file, its change is kept unchanged.`
    : `Landed as upstream bytes ${where}.`;
};

const ledgerMarkdown = (commits: readonly RoutedCommit[], judgements: Judgements): string => {
  const counts = (["retained", "replaced", "mixed", "outside-build"] as const)
    .map((route) => `${route} ${commits.filter((commit) => commit.route === route).length}`).join(", ");
  const rows = commits.map((commit) => [
    `\`${commit.sha}\``, commit.pullRequest, cell(commit.subject), commit.route,
    commit.paths.some((path) => path.conflicted) ? "yes" : "no",
    commit.paths.map(pathLine).map(cell).join("<br>"),
    cell(landingOf(commit, judgements)),
  ].join(" | "));
  return [
    `${commits.length} commits: ${counts}.`,
    "",
    "| Upstream | PR | Subject | Route | Conflicted | Touched paths: class; receiving owner; state at head | Where the outcome landed |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
  ].join("\n");
};

const main = (argv: readonly string[]): number => {
  const options = optionsFrom(argv);
  if (options === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const commits = routedCommits(options);
  const judgements = judgementsFrom(options.judgements);
  const unjudged = commits.filter((commit) => demandsJudgement(commit) && judgements[commit.sha] === undefined);
  process.stdout.write(ledgerMarkdown(commits, judgements));
  for (const commit of unjudged) process.stderr.write(`unjudged ${commit.route} commit ${commit.sha}\n`);
  return unjudged.length === 0 ? 0 : 1;
};

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
