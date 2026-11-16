import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  gitIn,
  isRecord,
  lineSeparated,
  nulSeparated,
  optionsFrom,
  routedCommits,
  type Options,
  type RoutedCommit,
  type RoutedPath,
} from "./route-ledger.ts";

type Category = 1 | 2 | 3 | 4;

type StructuralCategory = 1 | 2 | 3;

const CATEGORY_NAMES: Readonly<Record<Category, string>> = {
  1: "inside one bounded context",
  2: "crosses bridges",
  3: "outside the build side",
  4: "conflicted / needed shape changes",
};

type Lines = { readonly added: number; readonly removed: number };

type Numstat = Lines & { readonly path: string };

type Structural = {
  readonly category: StructuralCategory;
  readonly reason: string;
  readonly reachesBridgedRead: boolean;
};

type LogEntry = {
  readonly ids: readonly string[];
  readonly forcesCategoryFour: boolean;
};

type UnitRule = {
  readonly commit: string;
  readonly matches: (path: string) => boolean;
};

type Unit = {
  readonly id: string;
  readonly what: string;
  readonly upstream: readonly string[];
  readonly rules: readonly UnitRule[];
};

type UnitMeasure = {
  readonly unit: Unit;
  readonly source: Lines;
  readonly tests: Lines;
  readonly gross: Lines;
  readonly sharedFilesGross: Lines;
};

type ClassifiedCommit = {
  readonly commit: RoutedCommit;
  readonly category: Category;
  readonly structural: Structural;
  readonly log: LogEntry;
  readonly old: Lines;
  readonly oldOutsideBuild: Lines;
  readonly oldReplaced: Lines;
  readonly oldBinaryPaths: number;
};

type Extras = {
  readonly log: string;
  readonly merge: string;
};

type DuplicatedRule = {
  readonly sha: string;
  readonly rule: string;
  readonly duplicate: string;
  readonly owner: string;
};

const ZERO: Lines = { added: 0, removed: 0 };

const sum = (parts: readonly Lines[]): Lines =>
  parts.reduce((total, part) => ({ added: total.added + part.added, removed: total.removed + part.removed }), ZERO);

const lines = (parts: Lines): string => `+${parts.added}/−${parts.removed}`;

const isTestPath = (path: string): boolean => path.includes(".test.") || path.includes(".fixture.") || path.startsWith("tests/");

const everything = (): boolean => true;

const under = (prefix: string) => (path: string): boolean => path.startsWith(prefix);

const named = (...names: readonly string[]) => (path: string): boolean => names.includes(path);

const except = (name: string) => (path: string): boolean => path !== name;

const GLOSSARY = "src/glossary.json";

const UNITS: readonly Unit[] = [
  {
    id: "P1",
    what: "Kiro knowledge reading to the Kiro host owners (S1, then S7)",
    upstream: ["3ca1893e6"],
    rules: [
      { commit: "3bf9e622c", matches: everything },
      { commit: "eb126c7be", matches: except(GLOSSARY) },
      { commit: "db170b587", matches: named("src/projection/adapters/legacy-format-docs.test.ts") },
    ],
  },
  {
    id: "P2",
    what: "Kiro IDE skill inputs gain workflow.md",
    upstream: ["451098163"],
    rules: [{ commit: "a55b09eea", matches: under("src/") }],
  },
  {
    id: "P3",
    what: "Codex option letters in host data",
    upstream: ["ad4a0ad02"],
    rules: [
      { commit: "dbc15fbe8", matches: everything },
      { commit: "a512e25d7", matches: everything },
    ],
  },
  {
    id: "P4",
    what: "Copilot reviewers absorb knowledge",
    upstream: ["ad4a0ad02"],
    rules: [{ commit: "f79da925a", matches: everything }],
  },
  {
    id: "t294",
    what: "t294 lists its harnesses from the test matrix",
    upstream: ["ad4a0ad02"],
    rules: [{ commit: "7aac16444", matches: everything }],
  },
  {
    id: "P5",
    what: "OpenCode settings renderer relocates the engine import closure",
    upstream: ["986da3a04"],
    rules: [{ commit: "0aba2352c", matches: everything }],
  },
  {
    id: "P6",
    what: "Onboarding words and links in each host's fills",
    upstream: ["6e4a2e9ef", "56df50a28", "915d65c73", "6b2ac7d0a", "4398ec484", "2dd100baf"],
    rules: [{ commit: "33a609c69", matches: everything }],
  },
  {
    id: "P7",
    what: "Prior whole-file hashes in each host's distribution",
    upstream: ["486c052da", "6b2ac7d0a", "4398ec484"],
    rules: [{ commit: "c919167f6", matches: everything }],
  },
  {
    id: "P8",
    what: "NativePermissions in Packaging, Codex's line in its host",
    upstream: ["9a62cf9f1"],
    rules: [{ commit: "a9c1d6bbe", matches: everything }],
  },
  {
    id: "S3+S4",
    what: "Test matrix capability tierFlavor and the conductor skill files check",
    upstream: ["451098163", "9a62cf9f1", "0a3854daf"],
    rules: [
      { commit: "a55b09eea", matches: under("tests/") },
      { commit: "db170b587", matches: under("tests/") },
    ],
  },
  {
    id: "S5",
    what: "Glossary entries for the ported contracts",
    upstream: ["3ca1893e6", "9a62cf9f1"],
    rules: [
      { commit: "db170b587", matches: named(GLOSSARY) },
      { commit: "eb126c7be", matches: named(GLOSSARY) },
    ],
  },
  {
    id: "re-pin 2.11.4",
    what: "Bridge characterisation tests re-pinned to AIDLC_VERSION 2.11.4",
    upstream: ["9a45be65a"],
    rules: [
      { commit: "6b59a8efa", matches: named("src/packaging/adapters/legacy-channel.test.ts", "src/packaging/adapters/legacy-version.test.ts") },
    ],
  },
  {
    id: "re-pin status",
    what: "Bridge characterisation test re-pinned to the dropped status copy-channel allow",
    upstream: ["6e8d5c309"],
    rules: [{ commit: "6b59a8efa", matches: named("src/projection/adapters/legacy-dispatcher.test.ts") }],
  },
];

const EXCLUDED_FOUNDATION_WORK: readonly { readonly commit: string; readonly why: string }[] = [
  { commit: "b1b93e8fa", why: "goldens re-recorded from 8c4f79b4b's own build, and previous-release.json (S6)" },
  { commit: "7e586689b", why: "lint boundary and monolith records re-recorded for every upstream arrival" },
  { commit: "8e310c44d", why: "Zod parse removed from the plugin emitter adapter, unrelated to any upstream commit" },
];

const DUPLICATED_RULES: readonly DuplicatedRule[] = [
  {
    sha: "3ca1893e6",
    rule: "How a Kiro helper reads its knowledge folders (in parts, with the file tool).",
    duplicate:
      "A host-name branch (`harnessDir !== \".kiro\"`) in the shared runtime module `core/tools/aidlc-inline-context.ts`, called from two copies of the delegated-preflight block (`core/tools/aidlc-plugin-emit.ts` and `scripts/agent-knowledge.ts`). The commit also moved the Kiro wording out of the second copy into the first, which is the consolidation the shape already wanted, in the wrong owner.",
    owner:
      "`src/hosts/kiro/projection/knowledge-reading.ts` and `src/hosts/kiro-ide/projection/knowledge-reading.ts` through the `KnowledgeReading` port (S7). First landed in shared Projection (S1), the one wrong landing of the rebase. Residue: the test-only thin entry `scripts/agent-knowledge.ts:27` still picks in-parts by directory name, through the core clause, which leaves a second, test-only picker.",
  },
  {
    sha: "9a62cf9f1",
    rule: "What a native install's onboarding says about permissions.",
    duplicate:
      "A `tierFlavor === \"kiro\"` / `\"codex\"` switch in `scripts/package.ts`, and two tests that select Kiro by `tierFlavor`.",
    owner:
      "Each host's `distribution.ts` through `NativePermissions` (S2); `tierFlavor` survives only as a test capability in `tests/harness/harness-matrix.ts` (S3). Split landing: the host choice is in its owner (`src/hosts/kiro/distribution.ts:71`, `src/hosts/kiro-ide/distribution.ts:144`), but the Kiro-only `exactReadsLine` text is still in shared Packaging at `src/packaging/domain/native-onboarding.ts:9`, while Codex's line moved to its host. It predates the range, goes with Q199 and Q194, and is not fixed here.",
  },
  {
    sha: "6e8d5c309",
    rule: "Which hosts list their plugins, so need no `--plugin-root`; and the word a person types to enter AI-DLC on Codex.",
    duplicate:
      "`hostListsPlugins` (`claude` or `codex`) added to `core/tools/aidlc-plugin.ts` and restated as `HARNESS_NAME === \"claude\" || HARNESS_NAME === \"codex\"` in `scripts/plugin-hooks-template/compose.ts`, whose comment names the engine rule it copies; and `harnessDir === \".codex\" ? \"$aidlc\" : \"/aidlc\"` in `plugins/test-pro/tools/test-pro-doctor.ts`.",
    owner:
      "The entry word is Codex's `invoke: \"$aidlc\"` in `src/hosts/codex/onboarding-fills.ts`. The plugin-listing rule has no foundation owner file yet, so it is a host-name branch in shared code twice over, not yet a duplicate of a src owner.",
  },
  {
    sha: "ad4a0ad02",
    rule: "How many options a question shows, per host.",
    duplicate:
      "None added by the commit itself: the Codex lettering is ported to its owner, `src/hosts/codex/host-data.ts` (`OPTION_LETTERS: \"A-C\"`, P3). Listed for its residue.",
    owner:
      "Residue: `HostConversation.questionOptions` at `src/execution/application/boundary-ports.ts:25` has no implementation yet, and becomes a second home for the option count when the runtime half lands.",
  },
];

const valueOf = (argv: readonly string[], flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
};

const extrasFrom = (argv: readonly string[]): Extras | undefined => {
  const log = valueOf(argv, "--log");
  const merge = valueOf(argv, "--merge");
  return log === undefined || merge === undefined ? undefined : { log: resolve(log), merge };
};

const USAGE = [
  "usage: bun src/route-classification.ts --repository <checkout> --from <commit> --to <commit>",
  "  --foundation-before <commit> --head <commit> --bridge-map <file> --judgements <file>",
  "  --log <rebase log> --merge <merge commit>",
].join("\n");

const legacyOwnersFrom = (file: string): ReadonlyMap<string, readonly string[]> => {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
  const owners = isRecord(parsed) ? parsed["legacyOwners"] : undefined;
  if (!isRecord(owners)) throw new Error(`${file} has no legacyOwners`);
  return new Map(Object.entries(owners).map(([context, files]) => [
    context,
    Array.isArray(files) ? files.filter((entry): entry is string => typeof entry === "string") : [],
  ]));
};

const territoryContext = (owners: ReadonlyMap<string, readonly string[]>, path: string): string | undefined =>
  [...owners].find(([, patterns]) => patterns.some((pattern) =>
    pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : pattern === path))?.[0];

const ownerContext = (owner: string): string | undefined => {
  const host = /^src\/hosts\/([^/]+)/.exec(owner)?.[1];
  if (host !== undefined) return `hosts/${host}`;
  if (owner.startsWith("src/packaging") || owner.includes("src/packaging")) return "packaging";
  if (owner.startsWith("src/projection")) return "projection";
  if (owner.startsWith("lint/")) return "lint";
  return undefined;
};

const contextOf = (path: RoutedPath, owners: ReadonlyMap<string, readonly string[]>): string | undefined => {
  if (path.kind === "outside-build") return undefined;
  if (path.kind === "replaced") return ownerContext(path.owner);
  return territoryContext(owners, path.path);
};

const structuralOf = (commit: RoutedCommit, owners: ReadonlyMap<string, readonly string[]>): Structural => {
  const reachesBridgedRead = commit.paths.some((path) => path.bridgedReadsTouched.length > 0);
  const bridged = commit.paths.filter((path) => path.scrutiny === "dual-use");
  if (bridged.length > 0) {
    return { category: 2, reason: `touches bridge module ${bridged.map((path) => path.path).join(", ")}`, reachesBridgedRead };
  }
  const contexts = [...new Set(commit.paths.flatMap((path) => contextOf(path, owners) ?? []))];
  if (contexts.length > 1) return { category: 2, reason: `spans contexts ${contexts.join(", ")}`, reachesBridgedRead };
  if (contexts.length === 1) return { category: 1, reason: `only ${contexts[0] ?? ""}`, reachesBridgedRead };
  const outsideOnly = commit.paths.every((path) => path.kind === "outside-build");
  return { category: 3, reason: outsideOnly ? "docs, tests or CI only" : "runtime or shipped content no map entry owns", reachesBridgedRead };
};

const logEntries = (file: string): ReadonlyMap<string, LogEntry> => {
  const text = readFileSync(file, "utf-8");
  const table = text.slice(text.indexOf("## Every upstream commit"), text.indexOf("## Lint boundary rises"));
  return new Map(lineSeparated(table).filter((row) => row.startsWith("| `")).map((row) => {
    const cells = row.slice(2, -2).split(" | ");
    const sha = (cells[0] ?? "").replaceAll("`", "");
    const disposition = cells[cells.length - 1] ?? "";
    const forcesCategoryFour = disposition.startsWith("Conflict") || /\b[PS]\d\b/.test(disposition);
    const ids = forcesCategoryFour ? [...new Set(disposition.match(/\b[CPS]\d\b/g) ?? [])] : [];
    return [sha, { ids, forcesCategoryFour }] as const;
  }));
};

const numstatFrom = (output: string): readonly Numstat[] =>
  nulSeparated(output).map((record) => {
    const [added = "0", removed = "0", path = ""] = record.split("\t");
    return { path, added: Number(added) || 0, removed: Number(removed) || 0 };
  });

const binaryCount = (output: string): number =>
  nulSeparated(output).filter((record) => record.startsWith("-\t-\t")).length;

const totalOf = (entries: readonly Numstat[]): Lines => sum(entries);

const classify = (options: Options, extras: Extras): readonly ClassifiedCommit[] => {
  const git = gitIn(options.repository);
  const owners = legacyOwnersFrom(options.bridgeMap);
  const log = logEntries(extras.log);
  return routedCommits(options).map((commit) => {
    const raw = git(["show", "-z", "--numstat", "--no-renames", "--format=", commit.sha]);
    const entries = numstatFrom(raw);
    const kindOf = (path: string): RoutedPath["kind"] | undefined => commit.paths.find((entry) => entry.path === path)?.kind;
    const logEntry = log.get(commit.sha) ?? { ids: [], forcesCategoryFour: false };
    const structural = structuralOf(commit, owners);
    return {
      commit,
      structural,
      log: logEntry,
      category: logEntry.forcesCategoryFour ? 4 : structural.category,
      old: totalOf(entries),
      oldOutsideBuild: totalOf(entries.filter((entry) => kindOf(entry.path) === "outside-build")),
      oldReplaced: totalOf(entries.filter((entry) => kindOf(entry.path) === "replaced")),
      oldBinaryPaths: binaryCount(raw),
    };
  });
};

const measureUnit = (options: Options, extras: Extras, unit: Unit, claimed: ReadonlyMap<string, number>): UnitMeasure => {
  const git = gitIn(options.repository);
  const touched = unit.rules.flatMap((rule) =>
    numstatFrom(git(["show", "-z", "--numstat", "--no-renames", "--format=", rule.commit]))
      .filter((entry) => rule.matches(entry.path)));
  const paths = [...new Set(touched.map((entry) => entry.path))];
  const exclusive = paths.filter((path) => (claimed.get(path) ?? 0) === 1);
  const shared = paths.filter((path) => (claimed.get(path) ?? 0) > 1);
  const net = exclusive.length === 0 ? [] : numstatFrom(git(["diff", "-z", "--numstat", "--no-renames", extras.merge, options.head, "--", ...exclusive]));
  const sharedGross = touched.filter((entry) => shared.includes(entry.path));
  const all = [...net, ...sharedGross];
  return {
    unit,
    source: totalOf(all.filter((entry) => !isTestPath(entry.path))),
    tests: totalOf(all.filter((entry) => isTestPath(entry.path))),
    gross: totalOf(touched),
    sharedFilesGross: totalOf(sharedGross),
  };
};

const measureUnits = (options: Options, extras: Extras): readonly UnitMeasure[] => {
  const git = gitIn(options.repository);
  const claimed = new Map<string, number>();
  for (const unit of UNITS) {
    const paths = new Set(unit.rules.flatMap((rule) =>
      numstatFrom(git(["show", "-z", "--numstat", "--no-renames", "--format=", rule.commit]))
        .filter((entry) => rule.matches(entry.path)).map((entry) => entry.path)));
    for (const path of paths) claimed.set(path, (claimed.get(path) ?? 0) + 1);
  }
  return UNITS.map((unit) => measureUnit(options, extras, unit, claimed));
};

const unitCategory = (measure: UnitMeasure, byShort: ReadonlyMap<string, ClassifiedCommit>): Category => {
  const categories = new Set(measure.unit.upstream.map((sha) => byShort.get(sha)?.category));
  const [only] = [...categories];
  if (categories.size !== 1 || only === undefined) {
    throw new Error(`unit ${measure.unit.id} spans categories ${[...categories].join(", ")}`);
  }
  return only;
};

const unitTotal = (measure: UnitMeasure): Lines => sum([measure.source, measure.tests]);

const countRawGitReads = (options: Options, revision: string): number => {
  const git = gitIn(options.repository);
  const output = git(["grep", "-nE", "\"--(show-toplevel|git-common-dir|show-prefix|absolute-git-dir|git-dir)\"", revision, "--",
    "core", "scripts", "lint", ":!*.test.ts", ":!core/hooks/aidlc-plan-approval-guard.ts", ":!core/tools/aidlc-git.ts"], [0, 1]);
  return lineSeparated(output).length;
};

const srcGitOwners = (options: Options): readonly string[] => {
  const git = gitIn(options.repository);
  return lineSeparated(git(["grep", "-lE", "rev-parse|git-common-dir|show-toplevel", options.head, "--", "src", ":!*.test.ts"], [0, 1]));
};

const table = (header: readonly string[], rows: readonly (readonly string[])[]): string =>
  [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");

const cellText = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

const summaryRows = (classified: readonly ClassifiedCommit[], measures: readonly UnitMeasure[]): readonly (readonly string[])[] => {
  const byShort = new Map(classified.map((entry) => [entry.commit.sha, entry] as const));
  return ([1, 2, 3, 4] as const).map((category) => {
    const members = classified.filter((entry) => entry.category === category);
    const old = sum(members.map((entry) => entry.old));
    const replaced = sum(members.map((entry) => entry.oldReplaced));
    const outside = sum(members.map((entry) => entry.oldOutsideBuild));
    const units = measures.filter((measure) => unitCategory(measure, byShort) === category);
    const ported = sum(units.map((measure) => measure.source));
    const tests = sum(units.map((measure) => measure.tests));
    return [
      `${category}. ${CATEGORY_NAMES[category]}`,
      String(members.length),
      lines(old),
      lines(outside),
      lines(replaced),
      lines(sum([old, { added: -replaced.added, removed: -replaced.removed }])),
      lines(sum([ported, tests])),
      `${lines(ported)} / ${lines(tests)}`,
    ];
  });
};

const crossTab = (classified: readonly ClassifiedCommit[]): string =>
  table(["Structural category", "Final 1", "Final 2", "Final 3", "Final 4", "All"],
    ([1, 2, 3] as const).map((structural) => {
      const members = classified.filter((entry) => entry.structural.category === structural);
      const counts = ([1, 2, 3, 4] as const).map((category) => String(members.filter((entry) => entry.category === category).length));
      return [`${structural}. ${CATEGORY_NAMES[structural]}`, ...counts, String(members.length)];
    }));

const unitRows = (measures: readonly UnitMeasure[], byShort: ReadonlyMap<string, ClassifiedCommit>): readonly (readonly string[])[] =>
  measures.map((measure) => [
    measure.unit.id,
    cellText(measure.unit.what),
    measure.unit.upstream.map((sha) => `\`${sha}\``).join(", "),
    measure.unit.upstream.length === 1 ? "exact" : `shared by ${measure.unit.upstream.length}, not split`,
    String(unitCategory(measure, byShort)),
    lines(measure.source),
    lines(measure.tests),
    lines(measure.gross),
    lines(measure.sharedFilesGross),
  ]);

const commitRows = (classified: readonly ClassifiedCommit[], measures: readonly UnitMeasure[]): readonly (readonly string[])[] =>
  classified.map((entry) => {
    const own = measures.filter((measure) => measure.unit.upstream.includes(entry.commit.sha));
    const exact = own.filter((measure) => measure.unit.upstream.length === 1);
    const shared = own.filter((measure) => measure.unit.upstream.length > 1);
    const exactNew = sum(exact.map(unitTotal));
    const newCell = own.length === 0
      ? "none"
      : [
        exact.length === 0 ? "" : `${lines(exactNew)} (${exact.map((measure) => measure.unit.id).join(", ")})`,
        shared.length === 0 ? "" : `shared: ${shared.map((measure) => measure.unit.id).join(", ")}`,
      ].filter((part) => part !== "").join("; ");
    return [
      `\`${entry.commit.sha}\``,
      entry.commit.pullRequest,
      String(entry.category),
      entry.log.ids.join(", ") || "-",
      `${entry.structural.category}: ${cellText(entry.structural.reason)}`,
      lines(entry.old),
      lines(entry.oldReplaced),
      newCell,
    ];
  });

const bridgeFinding = (classified: readonly ClassifiedCommit[]): string => {
  const second = classified.filter((entry) => entry.category === 2);
  const reaching = second.filter((entry) => entry.structural.reachesBridgedRead);
  const crossing = second.filter((entry) => entry.structural.reason.startsWith("spans"));
  return `Category 2 holds ${second.length} commits: ${second.length - crossing.length} touch a bridge module and ${crossing.length} span contexts without touching one. ${reaching.length} of them change a named export, or a whole-module bridge, that a src reader imports.`;
};

const sensitivity = (classified: readonly ClassifiedCommit[]): string => {
  const unmapped = classified.filter((entry) => entry.category === 3 && entry.structural.reason.startsWith("runtime"));
  const monoliths = ["core/tools/aidlc-lib.ts", "core/tools/aidlc-orchestrate.ts", "core/tools/aidlc-init.ts"];
  const touchingMonoliths = classified.filter((entry) => entry.commit.paths.some((path) => monoliths.includes(path.path)));
  return `Category 3 holds ${classified.filter((entry) => entry.category === 3).length} commits, of which ${unmapped.length} touch runtime or shipped content that no map entry owns (core rules and stages, plugins, harness assets, unmapped core tools). If unmapped runtime counted as one context, those ${unmapped.length} would move to category 1. ${touchingMonoliths.length} commits touch \`aidlc-lib.ts\`, \`aidlc-orchestrate.ts\` or \`aidlc-init.ts\`; \`aidlc-lib.ts\` is a bridge module, the other two are unmapped.`;
};

const duplicatedSection = (byShort: ReadonlyMap<string, ClassifiedCommit>): string =>
  DUPLICATED_RULES.map((rule) => {
    const entry = byShort.get(rule.sha);
    const head = entry === undefined ? rule.sha : `\`${rule.sha}\` ${entry.commit.pullRequest}, category ${entry.category}`;
    return [`### ${head}`, "", `- **Rule:** ${rule.rule}`, `- **Duplicate:** ${rule.duplicate}`, `- **Shape owner:** ${rule.owner}`, ""].join("\n");
  }).join("\n");

const gitCoordinatesSection = (options: Options, byShort: ReadonlyMap<string, ClassifiedCommit>): string => {
  const entry = byShort.get("c4960e702");
  if (entry === undefined) throw new Error("c4960e702 is not in the range");
  const before = countRawGitReads(options, "c4960e702^");
  const after = countRawGitReads(options, "c4960e702");
  const inSrc = srcGitOwners(options);
  const direct = countRawGitReads(options, options.head);
  return [
    `\`c4960e702\` #3896 is category ${entry.category} (${entry.structural.reason}). It landed as upstream bytes: no conflict, no port, no shape change. It touches ${lines(entry.old)} lines in the old layout and none are rewritten on foundation.`,
    "",
    "It gives upstream's runtime one owner of git coordinates, `core/tools/aidlc-git.ts` (`projectInRepo`, `inRepo`, `inProject`, `gitCommonDirOf`). That is one owner inside the retained runtime. It is not one owner for the repository, and it is not a shape owner:",
    "",
    `- Upstream's own pin, \`tests/unit/t-project-in-repo.test.ts\`, lets five files keep 8 reads of \`--show-prefix\` or \`--git-common-dir\` ("NOT_YET_ON_THE_OWNER": \`aidlc-unit.ts\` 1, \`aidlc-lib.ts\` 1, \`aidlc-orchestrate.ts\` 1, \`aidlc-runtime-paths.ts\` 2, \`aidlc-worktree.ts\` 3) and 4 more in work not on main yet (\`IN_FLIGHT\`: \`aidlc-unit.ts\` 1, \`aidlc-unit-teams.ts\` 2, \`aidlc-session-start.ts\` 1). That scan covers \`core/\` and \`harness/\` only, and never counts \`--show-toplevel\`.`,
    `- A wider text count of direct \`rev-parse\` reads of the five git-coordinate flags in \`core/\`, \`scripts/\` and \`lint/\` outside \`aidlc-git.ts\` is ${before} before the commit, ${after} after it and ${direct} on foundation's head (one more than the pin: the gate's own read in lint/) (\`git grep -nE '"--(show-toplevel|git-common-dir|show-prefix|absolute-git-dir|git-dir)"'\`, test files and the guard's command parser excluded).`,
    `- \`src/\` has no git owner: ${inSrc.length === 0 ? "no non-test file under `src/` runs `rev-parse`" : `${inSrc.length} non-test files under \`src/\` mention it`}. The shape's own side reads the common dir itself, in \`lint/gate/adapters/directory-lock.ts\`, and \`scripts/release-promotion.ts\` reads it again.`,
    "- `core/tools/aidlc-lib.ts` is a bridge module (read as types by `src/projection/domain/host-surface.ts` and as runtime by `src/projection/adapters/legacy-workspace-commands.ts`), which is why the commit crosses bridges. The commit changes no named export those readers import.",
    "- `core/tools/aidlc-git.ts` is in no `legacyOwners` territory, so the map does not say which bounded context takes it over. That is the open question for \"one owner\": the runtime has one, the shape has none.",
  ].join("\n");
};

const document = (options: Options, extras: Extras, classified: readonly ClassifiedCommit[]): string => {
  const measures = measureUnits(options, extras);
  const byShort = new Map(classified.map((entry) => [entry.commit.sha, entry] as const));
  const git = gitIn(options.repository);
  const excluded = EXCLUDED_FOUNDATION_WORK.map((work) => [
    `\`${work.commit}\``, cellText(work.why),
    lines(totalOf(numstatFrom(git(["show", "-z", "--numstat", "--no-renames", "--format=", work.commit])))),
  ]);
  const header = ["Category", "Commits", "Old layout lines, all paths", "of which docs, tests, CI", "of which replaced paths",
    "carried as upstream bytes", "New layout lines, all", "ported source / tests"];
  return [
    "# Rebase classification: caea995ae..8c4f79b4b",
    "",
    `Classifies the ${classified.length} upstream commits into Helen's four categories, and measures the lines each touched in the old layout (upstream's own diff at the pin) and where its outcome lives on \`study/foundation-8c4f79b\`. The table is generated by \`src/route-classification.ts\` from the [route ledger](rebase-8c4f79b-ledger.md) routes and the [rebase log](rebase-8c4f79b-log.md).`,
    "",
    "## Rule",
    "",
    "One category per commit, decided in this order. The first that holds wins.",
    "",
    "1. **Conflicted / needed shape changes (4).** The log's per-commit disposition says `Conflict (…)`, or names a port (P1 to P8) or a shape change (S1 to S7). Category 4 overrides the others, so the four categories partition the 126. The category the commit would have had is kept in its own column and in the cross-tab below, so nothing is lost. A commit that only touches a path that conflicted for another commit (the t239 rows, the `kiro.md` follow-ons) merged unchanged, is not in 4, and keeps its structural category. Bridge re-pins of characterisation tests (9a45be65a, 6e8d5c309) change no code and are not in 4.",
    "2. **Crosses bridges (2).** It touches a module the bridge map lists as a bridge (a legacy owner a src reader imports), or its paths fall in more than one context of the map. Contexts come from `legacyOwners` for retained files and from the receiving owner for replaced ones.",
    "3. **Inside one bounded context (1).** Every path that the map places lies in one context, and none is a bridge module. Docs, tests and CI paths are ignored.",
    "4. **Outside the build side (3).** Nothing the commit touches is in a context: docs, tests and CI only, or runtime and shipped content no map entry owns.",
    "",
    "## Summary",
    "",
    table(header, summaryRows(classified, measures)),
    "",
    "Lines are added/removed. Old layout is `git show --numstat --no-renames` of each upstream commit. \"Carried as upstream bytes\" is old lines minus replaced paths: those paths landed unchanged, so their old and new lines are the same. New layout lines are what foundation wrote in the receiving owners after the merge (`" + extras.merge + "` to `" + options.head + "`).",
    "",
    "### Structural category against final category",
    "",
    crossTab(classified),
    "",
    bridgeFinding(classified),
    "",
    sensitivity(classified),
    "",
    "## New layout lines, by port",
    "",
    "Net lines: `git diff --numstat` from the merge to the rebased head over the files only that port touches. Where two ports touch the same file, that file's lines are the gross numstat of the port's own commit and are counted in the port that wrote them (the last column shows how many lines are of that kind). A port that serves several upstream commits is marked shared and is not split between them.",
    "",
    table(["Port", "What", "Upstream", "Attribution", "Category", "Source", "Tests", "Gross, all commits", "of which in shared files"], unitRows(measures, byShort)),
    "",
    "P1's gross lines include S1's churn, which S7 then reversed; the net column is what remains. Merge-conflict resolutions (C1 to C8) leave the retired paths deleted or foundation's text kept, so they add no new-layout lines of their own.",
    "",
    "Foundation work after the merge that is not attributed to any upstream commit, and is kept out of the comparison:",
    "",
    table(["Commit", "What", "Lines"], excluded),
    "",
    "## Duplicated rules",
    "",
    "A callout names a rule the shape gives one owner, an upstream commit that adds or extends logic for it, and the owner file on foundation. The scans were: added lines in `core/`, `scripts/`, `plugins/` and `harness/` naming a host in a comparison, `case` or `includes`; and three-line windows of added code that already exist elsewhere at the pin. The copied-block scan finds only exact line matches, so it misses a rule restated in other words; it matched one three-line window, in `core/tools/aidlc-plugin-validate.ts`, that also appears in `aidlc-plugin-build.ts` (6e8d5c309), which was not read further. A host-name branch in retained runtime with no owner file on foundation (for example `aidlc-init.ts` and `aidlc-doctor.ts` in 445578dc9 #3976 and 50a9e926c #3963, `runtimeHarnessName() === \"claude\"` in 5e561ab1a #3755, the Codex branches in 4397f483d #3805) is not counted as a duplicate here.",
    "",
    duplicatedSection(byShort),
    "## #3896: one owner for git coordinates",
    "",
    gitCoordinatesSection(options, byShort),
    "",
    "## Biome rows",
    "",
    "The three `biome.json` commits (237a65f1a #3780, 575079bed #3863, b650965ea #3933) lower `maxSize` (1778000, 1769000, 1768000, 1767000). They are not a rise. Their successor, `tests/ratchets/monolith-lines.json`, re-records `core/tools/aidlc-lib.ts` from 42322 to 42114 in `7e586689b`, and that re-record is still a proposal, not accepted.",
    "",
    "## Every commit",
    "",
    table(["Upstream", "PR", "Cat", "Log ids", "Structural", "Old layout", "Old, replaced paths", "New layout"], commitRows(classified, measures)),
    "",
  ].join("\n");
};

const main = (argv: readonly string[]): number => {
  const options = optionsFrom(argv);
  const extras = extrasFrom(argv);
  if (options === undefined || extras === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const classified = classify(options, extras);
  process.stdout.write(document(options, extras, classified));
  const total = ([1, 2, 3, 4] as const).reduce((count, category) => count + classified.filter((entry) => entry.category === category).length, 0);
  if (total !== classified.length || classified.length !== 126) {
    process.stderr.write(`categories sum to ${total} of ${classified.length} commits, expected 126\n`);
    return 1;
  }
  return 0;
};

if (import.meta.main) process.exit(main(Bun.argv.slice(2)));
