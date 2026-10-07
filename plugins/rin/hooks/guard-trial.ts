// Guard-relaxation trial: the enumerative relax token and its deny-shadow log.
//
// Record 260904-guard-relaxation-trial-2. Two guards may be relaxed for a
// time-boxed measurement -- block-inline-exec and guard-navigation -- so that
// what they actually catch can be counted instead of assumed.
//
// THIS MODULE IS THE TESTED SPECIFICATION, NOT THE IMPORTED IMPLEMENTATION.
// Both guards INLINE these semantics rather than importing them, because each
// must run when spawned as a standalone copy at an arbitrary path -- a property
// mutant-detection.test.ts asserts, and which a relative import breaks. That is
// duplication with a reason, and it is bounded three ways: guard-trial.test.ts
// pins the semantics here, guard-trial-relaxation.test.ts proves both live
// hooks behave identically to them on both faces, and guard-trial-scope.test.ts
// holds every copy to the same safety property. A future harness that can
// resolve a shared import from a relocated hook should collapse the copies back
// onto this module.
//
// THE SAFETY PROPERTY IS STRUCTURAL, NOT A PROMISE. The token names guards
// individually, and only the two relaxed guards import this module. The
// safety-critical guards (primary-commit, vault-write, github-writes, the
// audit and verdict guards, destructive-git) never read it, so no value of
// RIN_GUARD_TRIAL can disable them -- there is no token that reaches them.
// guard-trial-scope.test.ts asserts that negative property against the tree so
// it survives later edits.
//
// FAILS CLOSED. An absent, empty, or unrecognised token yields an empty relax
// set, which restores full enforcement. The empty set is the INITIAL value that
// parsing adds to, never a default assigned after a failed parse, so no throw
// path can leave a guard relaxed.
//
// THE LOG IS THE MEASUREMENT. A relaxed guard appends one line where it would
// have denied, then allows. Same branch, same condition: the deny-shadow set is
// exactly the set the guard's own patterns matched, captured without recall or
// self-report. Logging failure never blocks the command -- the trial is an
// observation, not a gate.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const RELAX_TOKEN_VARIABLE = "RIN_GUARD_TRIAL";
const LOG_PATH_VARIABLE = "RIN_GUARD_TRIAL_LOG";
const COMMON_DIR_POINTER = "commondir";
const COMMON_DIR_TOKEN_FILE = "rin-guard-trial";
const PROJECT_DIR_VARIABLE = "CLAUDE_PROJECT_DIR";
const SHADOW_LOG_RUNTIME_FILE = "rin-guard-trial-shadow.jsonl";

const DEFAULT_LOG_RELATIVE_PATH = join(".claude", "guard-trial-shadow.jsonl");

type RelaxableGuard = "relax-inline-exec" | "navigation";

const RELAXABLE_GUARDS: readonly RelaxableGuard[] = [
  "relax-inline-exec",
  "navigation",
];

const isRelaxableGuard = (candidate: string): candidate is RelaxableGuard =>
  RELAXABLE_GUARDS.some((guard) => guard === candidate);

// Additive by construction: start empty, admit only recognised names. An
// unrecognised name is dropped rather than widening the set or throwing.
const parseRelaxSet = ({
  token,
}: {
  readonly token: string | undefined;
}): ReadonlySet<RelaxableGuard> =>
  new Set(
    (token ?? "")
      .split(",")
      .map((candidate) => candidate.trim())
      .filter(isRelaxableGuard),
  );

// A worktree's `.git` is a FILE pointing at `<primary>/.git/worktrees/<name>`,
// which carries a `commondir` pointer back to the primary's git dir. Resolving
// through it gives every worktree ONE token source without committing the value
// — the same resolution the operator-steer ledger and the review scribe use.
const primaryGitDirectoryFrom = (
  startDirectory: string,
): string | undefined => {
  const gitPath = join(startDirectory, ".git");
  if (!existsSync(gitPath)) {
    const parent = dirname(startDirectory);
    return parent === startDirectory
      ? undefined
      : primaryGitDirectoryFrom(parent);
  }
  if (statSync(gitPath).isDirectory()) return gitPath;
  const pointer = readFileSync(gitPath, "utf8").match(/^gitdir:\s*(.+?)\s*$/m);
  const pointerTarget = pointer?.[1];
  if (pointerTarget === undefined) return undefined;
  const worktreeGitDir = isAbsolute(pointerTarget)
    ? pointerTarget
    : resolve(startDirectory, pointerTarget);
  const commonDirPointer = join(worktreeGitDir, COMMON_DIR_POINTER);
  if (!existsSync(commonDirPointer)) return worktreeGitDir;
  const commonDir = readFileSync(commonDirPointer, "utf8").trim();
  if (commonDir === "") return worktreeGitDir;
  return isAbsolute(commonDir) ? commonDir : resolve(worktreeGitDir, commonDir);
};

// The token's ONE durable home: `<git-common-dir>/rin-guard-trial`, which every
// worktree resolves to the same file. It is inside `.git`, so it is untracked by
// construction — the value cannot reach the Pi, CI, or another clone, which is
// the property the gitignored settings file was chosen for. Unlike a per-worktree
// copy it does not go stale when the operator changes the token, and reversal
// stays "delete one file".
//
// UNREADABLE READS AS ABSENT, which restores full enforcement — the same
// fail-closed direction as an absent env token.
const commonDirToken = ({
  startDirectory,
}: {
  readonly startDirectory: string;
}): string | undefined => {
  try {
    const gitDirectory = primaryGitDirectoryFrom(startDirectory);
    if (gitDirectory === undefined) return undefined;
    const tokenPath = join(gitDirectory, COMMON_DIR_TOKEN_FILE);
    return existsSync(tokenPath)
      ? readFileSync(tokenPath, "utf8").trim()
      : undefined;
  } catch {
    return undefined;
  }
};

// The env var WINS when present: it is the per-session override an operator or a
// probe uses without touching the shared file. The common-dir token is the
// fleet-wide default underneath it.
const relaxTokenFrom = ({
  environment,
}: {
  readonly environment: Readonly<Record<string, string | undefined>>;
}): string | undefined => {
  const fromEnvironment = environment[RELAX_TOKEN_VARIABLE];
  if (fromEnvironment !== undefined && fromEnvironment.trim() !== "")
    return fromEnvironment;
  return commonDirToken({
    startDirectory: environment[PROJECT_DIR_VARIABLE] ?? process.cwd(),
  });
};

const guardIsRelaxed = ({
  guard,
  environment,
}: {
  readonly guard: RelaxableGuard;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): boolean =>
  parseRelaxSet({ token: relaxTokenFrom({ environment }) }).has(guard);

// The log is per-clone RUNTIME and must never land inside the composed tree.
//
// The previous fallback was `join(CLAUDE_PROJECT_DIR ?? process.cwd(), ".claude/
// guard-trial-shadow.jsonl")`, and a hook spawned from `.claude/hooks/` has THAT
// as its cwd — so the log was written to `.claude/hooks/.claude/
// guard-trial-shadow.jsonl`, inside the projected plugin. `harness:refresh-check`
// then reported a composed copy diverging from its source and refused pushes
// intermittently, worsening as the log grew. Measured 2026-09-05: Lane C lost two
// pushes to it.
//
// Resolving through the git common dir puts it beside the token it pairs with:
// one file per clone, inside `.git`, so it is untracked by construction and no
// refresh-check, orphan sweep or diff can ever see it. It also means every
// worktree appends to ONE log, which is what the trial's corpus wants — a
// per-worktree log would fragment the measurement across 238 checkouts.
//
// The env override still wins, and the pre-common-dir fallback is kept for a
// non-git context (a spawned copy at an arbitrary path, which mutant-detection
// asserts must still run) — but it now roots at the REPO, never at the hooks dir.
const shadowLogPath = ({
  environment,
}: {
  readonly environment: Readonly<Record<string, string | undefined>>;
}): string => {
  const configured = environment[LOG_PATH_VARIABLE];
  if (configured !== undefined && configured.trim() !== "") return configured;
  const startDirectory = environment[PROJECT_DIR_VARIABLE] ?? process.cwd();
  const gitDirectory = primaryGitDirectoryFrom(startDirectory);
  if (gitDirectory !== undefined)
    return join(gitDirectory, SHADOW_LOG_RUNTIME_FILE);
  return join(startDirectory, DEFAULT_LOG_RELATIVE_PATH);
};

// Whether Claude Code's own worktree isolation would ALSO have refused this
// command. This is the sharpest column the trial produces for guard-navigation:
// the built-in overlaps that guard's territory, so a shadow line the built-in
// also covers is evidence the repo rule is REDUNDANT, while one it would not
// catch is the rule's residual value. Without the split, both look identical in
// the tally and the end-of-trial call is much blunter.
//
// "likely-covered" is deliberately hedged. The built-in's exact predicate is
// not ours to read, so this records a SHAPE match against its observed
// behaviour, not a claim about its implementation. Analysis must treat it as a
// strong hint to be spot-checked, never as ground truth -- and it is recorded
// per line precisely so a later reader can re-derive it if the built-in changes.
type BuiltInCoverage = "likely-covered" | "not-covered" | "not-applicable";

// Observed refusals, measured 2026-09-04 in a worktree-isolated session:
//
//   1. `git -C <path>` — refused by name.
//   2. ANY command mentioning git in a form the isolation checker calls "too
//      complex to verify that it stays inside the worktree" — and complexity
//      here means SHELL COMPLEXITY, not git's position. A chained command was
//      refused on that wording while git appeared only inside a quoted string.
//
// Point 2 is the correction to a defect this classifier shipped with. The first
// version anchored the pattern at `git` and scanned FORWARD, so `cd X && git
// log` — git in the tail — read as not-covered and was credited to the repo
// rule as residual value. The bias ran one way only, toward a wrong KEEP, and
// hit `cd-then-chain`, plausibly the highest-volume navigation rule. Caught in
// review before any data was collected. Test the whole command for a git
// mention AND a chaining metacharacter independently, never one relative to the
// other.
const gitDashCForm = /(?:^|&&|\|\||[\n;&|(`])\s*git\s+-C\b/;
const mentionsGit = /\bgit\b/;
const carriesShellComplexity = /(?:&&|\|\||[;|`]|\$\(|<<)/;

const builtInCoverageOf = ({
  guard,
  command,
}: {
  readonly guard: RelaxableGuard;
  readonly command: string;
}): BuiltInCoverage => {
  // The built-in guards worktree containment, which is navigation's territory.
  // It says nothing about inline code execution.
  if (guard !== "navigation") return "not-applicable";
  if (gitDashCForm.test(command)) return "likely-covered";
  return mentionsGit.test(command) && carriesShellComplexity.test(command)
    ? "likely-covered"
    : "not-covered";
};

type DenyShadowEntry = {
  readonly at: string;
  readonly guard: RelaxableGuard;
  readonly rule: string;
  readonly command: string;
  readonly cwd: string;
  readonly session: string;
  readonly builtInCoverage: BuiltInCoverage;
};

// The spawn cwd decides whether a session's silence is evidence at all: in a
// subdir-spawned session no repo hook loads, so "no incidents" there means
// nothing. Recording it per line is what lets the analysis exclude that
// population instead of silently averaging it in (rin-requirements 5.3).
const denyShadowEntry = ({
  guard,
  rule,
  command,
  environment,
  nowIso,
}: {
  readonly guard: RelaxableGuard;
  readonly rule: string;
  readonly command: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly nowIso: string;
}): DenyShadowEntry => ({
  at: nowIso,
  guard,
  rule,
  command,
  cwd: environment[PROJECT_DIR_VARIABLE] ?? process.cwd(),
  session: environment["CLAUDE_SESSION_ID"] ?? "unknown",
  builtInCoverage: builtInCoverageOf({ guard, command }),
});

const recordDenyShadow = ({
  guard,
  rule,
  command,
  environment,
  nowIso,
}: {
  readonly guard: RelaxableGuard;
  readonly rule: string;
  readonly command: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly nowIso: string;
}): void => {
  const entry = denyShadowEntry({
    guard,
    rule,
    command,
    environment,
    nowIso,
  });
  const path = shadowLogPath({ environment });
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // An unwritable log must not turn an allowed command into a failure.
  }
};

export {
  type BuiltInCoverage,
  builtInCoverageOf,
  COMMON_DIR_TOKEN_FILE,
  commonDirToken,
  DEFAULT_LOG_RELATIVE_PATH,
  type DenyShadowEntry,
  denyShadowEntry,
  guardIsRelaxed,
  LOG_PATH_VARIABLE,
  PROJECT_DIR_VARIABLE,
  parseRelaxSet,
  RELAX_TOKEN_VARIABLE,
  RELAXABLE_GUARDS,
  type RelaxableGuard,
  recordDenyShadow,
  relaxTokenFrom,
  SHADOW_LOG_RUNTIME_FILE,
  shadowLogPath,
};
