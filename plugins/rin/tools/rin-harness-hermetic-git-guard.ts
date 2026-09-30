import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PRUNED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  "vendor",
  ".aidlc-dist",
  "worktrees",
]);

const TEST_FILE_SUFFIXES = [
  ".test.ts",
  ".test.tsx",
  ".test.mjs",
  ".test.js",
  ".spec.ts",
  ".spec.mjs",
] as const;

const GIT_SPAWN_PATTERN =
  /\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec|execa|execaSync)\s*\(\s*(?:"git"|'git'|`git`)/;

const GIT_SPAWN_OPTIONS_SPAN = 8;

const ALLOWANCE_FILE = ".hermetic-git-allowances.json";

const MINIMUM_EXPECTED_TEST_FILES = 400;

type GuardFinding = {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

type GuardOutcome = {
  readonly pass: boolean;
  readonly scannedCount: number;
  readonly breachesScanFloor: boolean;
  readonly findings: readonly GuardFinding[];
  readonly staleAllowances: readonly string[];
};

const isTestFile = (filePath: string): boolean =>
  TEST_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix));

const walkCandidateFiles = ({
  rootDir,
}: {
  readonly rootDir: string;
}): readonly string[] => {
  const entries = (() => {
    try {
      return readdirSync(rootDir, { withFileTypes: true });
    } catch {
      return [];
    }
  })();
  return entries.flatMap((entry) => {
    const entryPath = resolve(rootDir, entry.name);
    if (entry.isDirectory()) {
      return PRUNED_DIRECTORY_NAMES.has(entry.name)
        ? []
        : walkCandidateFiles({ rootDir: entryPath });
    }
    return isTestFile(entry.name) ? [entryPath] : [];
  });
};

const HERMETIC_ENVIRONMENT_PATTERN =
  /\benv\s*:\s*[^,\n]*\b(?:hermeticGitEnvironment|withoutInheritedGitBindings|environment)\b/;

const AMBIENT_ENVIRONMENT_PATTERN = /\benv\s*:\s*[^,\n]*\bprocess\.env\b/;

const spawnIsHermetic = ({
  lines,
  index,
}: {
  readonly lines: readonly string[];
  readonly index: number;
}): boolean => {
  const span = lines.slice(index, index + GIT_SPAWN_OPTIONS_SPAN);
  if (span.some((lineBody) => AMBIENT_ENVIRONMENT_PATTERN.test(lineBody))) {
    return false;
  }
  return span.some((lineBody) => HERMETIC_ENVIRONMENT_PATTERN.test(lineBody));
};

const gitSpawnFindings = ({
  relativePath,
  body,
}: {
  readonly relativePath: string;
  readonly body: string;
}): readonly GuardFinding[] => {
  const lines = body.split("\n");
  return lines.flatMap((lineBody, index) =>
    GIT_SPAWN_PATTERN.test(lineBody) && !spawnIsHermetic({ lines, index })
      ? [
          {
            file: relativePath,
            line: index + 1,
            snippet: lineBody.trim(),
          },
        ]
      : [],
  );
};

const readAllowances = ({
  projectDir,
}: {
  readonly projectDir: string;
}): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(resolve(projectDir, ALLOWANCE_FILE), "utf8"),
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const file: unknown = Reflect.get(entry, "file");
      const reason: unknown = Reflect.get(entry, "reason");
      if (typeof file !== "string") return [];
      if (typeof reason !== "string" || reason.trim().length === 0) return [];
      return [file];
    });
  } catch {
    return [];
  }
};

const toPosix = (value: string): string => value.split("\\").join("/");

type HermeticClass = {
  readonly id: string;
  readonly findingsIn: (input: {
    readonly relativePath: string;
    readonly body: string;
  }) => readonly GuardFinding[];
};

const HERMETIC_CLASSES: readonly HermeticClass[] = [
  { id: "real-git-spawn", findingsIn: gitSpawnFindings },
];

const runGuard = ({
  projectDir,
  minimumExpectedTestFiles,
}: {
  readonly projectDir: string;
  readonly minimumExpectedTestFiles: number;
}): GuardOutcome => {
  const allowances = readAllowances({ projectDir });
  const candidates = walkCandidateFiles({ rootDir: projectDir });
  const offending = candidates.flatMap((filePath) => {
    const relativePath = toPosix(relative(projectDir, filePath));
    const body = readFileSync(filePath, "utf8");
    return HERMETIC_CLASSES.flatMap((hermeticClass) =>
      hermeticClass.findingsIn({ relativePath, body }),
    );
  });
  const findings = offending.filter(
    (finding) => !allowances.includes(finding.file),
  );
  const offendingPaths = new Set(offending.map((finding) => finding.file));
  const staleAllowances = allowances.filter(
    (allowance) => !offendingPaths.has(allowance),
  );
  const breachesScanFloor = candidates.length < minimumExpectedTestFiles;
  return {
    pass:
      findings.length === 0 &&
      staleAllowances.length === 0 &&
      !breachesScanFloor,
    scannedCount: candidates.length,
    breachesScanFloor,
    findings,
    staleAllowances,
  };
};

const parseProjectDir = (argv: readonly string[]): string => {
  const index = argv.indexOf("--project-dir");
  const value = index >= 0 ? argv[index + 1] : undefined;
  return resolve(value ?? process.cwd());
};

const scanFloorReport = (outcome: GuardOutcome): string =>
  [
    `Hermetic-git guard: FAIL — scanned ${outcome.scannedCount} test file(s), expected at least ${MINIMUM_EXPECTED_TEST_FILES}.`,
    "The walk no longer reaches the tree it governs, so a PASS here would report over a collapsed set.",
    "Check PRUNED_DIRECTORY_NAMES and --project-dir before trusting any result above.",
    "",
  ].join("\n");

const reportOf = (outcome: GuardOutcome): string => {
  if (outcome.breachesScanFloor) {
    return scanFloorReport(outcome);
  }
  if (outcome.pass) {
    return `Hermetic-git guard: PASS — ${outcome.scannedCount} test file(s) scanned, 0 unhermetic git spawns.\n`;
  }
  const findingLines = outcome.findings.map(
    (finding) =>
      `  [unhermetic-git-spawn] ${finding.file}:${finding.line} — ${finding.snippet}`,
  );
  const staleLines = outcome.staleAllowances.map(
    (allowance) =>
      `  [stale allowance] ${allowance} — suppresses nothing; delete the entry from ${ALLOWANCE_FILE}`,
  );
  return [
    `Hermetic-git guard: FAIL — ${outcome.findings.length} unhermetic git spawn(s), ${outcome.staleAllowances.length} stale allowance(s) across ${outcome.scannedCount} test file(s).`,
    ...findingLines,
    ...staleLines,
    "",
    `CD-47: tests are hermetic — no real side effects on anything real.`,
    ``,
    `A test that spawns a real git subprocess must build its environment with the shared helper`,
    `(.claude/tools/hermetic-git/): createHermeticGitRepository() for a temp repo, or`,
    `hermeticGitEnvironment() for a bare environment. Inheriting the ambient environment lets a`,
    `git-hook GIT_DIR redirect 'git init' onto the developer's shared checkout, which flips`,
    `core.bare and breaks the primary plus every worktree.`,
    "",
  ].join("\n");
};

const main = (): void => {
  const projectDir = parseProjectDir(process.argv.slice(2));
  const outcome = runGuard({
    projectDir,
    minimumExpectedTestFiles: MINIMUM_EXPECTED_TEST_FILES,
  });
  process.stdout.write(reportOf(outcome));
  process.exit(outcome.pass ? 0 : 1);
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();

export {
  ALLOWANCE_FILE,
  GIT_SPAWN_PATTERN,
  type GuardFinding,
  type GuardOutcome,
  MINIMUM_EXPECTED_TEST_FILES,
  runGuard,
  walkCandidateFiles,
};
