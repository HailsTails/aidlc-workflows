import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const readStdin = () =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const denyCall = ({ reason }) => {
  process.stderr.write(reason);
  process.exit(2);
};

// Guard-relaxation trial (record 260904-guard-relaxation-trial-2). Mirrors
// plugins/rin/hooks/guard-trial.ts, which this .mjs file cannot import. The
// token names guards individually and this guard answers only to its own name,
// so no value of it reaches a safety-critical guard. Fails closed: the relax
// set starts empty and only a recognised name is admitted.
const RELAX_TOKEN_VARIABLE = "RIN_GUARD_TRIAL";
const THIS_GUARD_RELAX_NAME = "navigation";

const thisGuardIsRelaxed = () =>
  (process.env[RELAX_TOKEN_VARIABLE] ?? "")
    .split(",")
    .map((candidate) => candidate.trim())
    .includes(THIS_GUARD_RELAX_NAME);

// Resolves the log OUTSIDE the composed tree. The previous fallback rooted at
// process.cwd(), and a hook spawned from `.claude/hooks/` has THAT as its cwd,
// so the log landed at `.claude/hooks/.claude/guard-trial-shadow.jsonl` inside
// the projected plugin -- harness:refresh-check then saw a composed copy
// diverging from its source and refused pushes repo-wide. The git common dir is
// untracked by construction and is shared by every worktree, so the trial's
// corpus stays in ONE file. Mirrors guard-trial.ts; see the note there.
const primaryGitDirectoryFrom = (startDirectory) => {
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
  const commonDirPointer = join(worktreeGitDir, "commondir");
  if (!existsSync(commonDirPointer)) return worktreeGitDir;
  const commonDir = readFileSync(commonDirPointer, "utf8").trim();
  if (commonDir === "") return worktreeGitDir;
  return isAbsolute(commonDir) ? commonDir : resolve(worktreeGitDir, commonDir);
};

const shadowLogPath = () => {
  const configured = process.env["RIN_GUARD_TRIAL_LOG"];
  if (configured !== undefined && configured.trim() !== "") return configured;
  const startDirectory = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
  const gitDirectory = primaryGitDirectoryFrom(startDirectory);
  if (gitDirectory !== undefined)
    return join(gitDirectory, "rin-guard-trial-shadow.jsonl");
  return join(startDirectory, ".claude", "guard-trial-shadow.jsonl");
};

// Whether Claude Code's own worktree isolation would ALSO have refused this.
// The built-in overlaps this guard's territory, so a shadow line it also covers
// is evidence this rule is REDUNDANT, while one it would not catch is the
// rule's residual value. Recording the split per line is what makes the
// end-of-trial keep/drop call sharp rather than a single undifferentiated
// total. Deliberately hedged as "likely": the built-in's predicate is not ours
// to read, so this is a SHAPE match against observed behaviour (measured
// 2026-09-04) to be spot-checked in analysis, never treated as ground truth.
// Complexity means SHELL complexity, not git's position in the command: a
// chained command was refused on that wording while git appeared only inside a
// quoted string. An earlier version anchored at `git` and scanned forward, so
// `cd X && git log` read as not-covered and was credited to this rule as
// residual value — a one-way bias toward a wrong KEEP, on plausibly the
// highest-volume rule here. Test for a git mention AND chaining independently.
const gitDashCForm = /(?:^|&&|\|\||[\n;&|(`])\s*git\s+-C\b/;
const mentionsGit = /\bgit\b/;
const carriesShellComplexity = /(?:&&|\|\||[;|`]|\$\(|<<)/;

const builtInCoverageOf = ({ command }) => {
  if (gitDashCForm.test(command)) return "likely-covered";
  return mentionsGit.test(command) && carriesShellComplexity.test(command)
    ? "likely-covered"
    : "not-covered";
};

// Written on the SAME branch the deny would have taken, so the shadow set is
// exactly what the patterns matched. A log failure never fails the command.
const recordDenyShadow = ({ rule, command }) => {
  const entry = {
    at: new Date().toISOString(),
    guard: THIS_GUARD_RELAX_NAME,
    rule,
    command,
    cwd: process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd(),
    session: process.env["CLAUDE_SESSION_ID"] ?? "unknown",
    builtInCoverage: builtInCoverageOf({ command }),
  };
  const path = shadowLogPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // An unwritable log must not turn an allowed command into a failure.
  }
};

const navigationRules = [
  {
    name: "cd-then-chain",
    pattern: /^\s*(cd|pushd)\s+["']?[^&|;]+["']?\s*(&&|;|\|)/i,
    reason:
      "Blocked: leading cd/pushd then chaining. The shell cwd is already the correct project/worktree root - drop the prefix and run the command directly. Switch worktrees with the EnterWorktree tool, never cd. Scope to a package with `pnpm --filter` / `pnpm -C`, not cd.",
  },
  {
    name: "cd-absolute-path",
    pattern: /^\s*(cd|pushd|Set-Location|sl)\s+["']?([A-Za-z]:[\\/]|\/|~)/i,
    reason:
      "Blocked: changing directory into an absolute path. Shell state does not persist between tool calls, so this only signals cwd confusion. Use the EnterWorktree tool to change worktree; otherwise run from the current cwd.",
  },
  {
    name: "git-dash-c",
    pattern: /(?:^|&&|\|\||[\n;&|(`])\s*git\s+-C\b/,
    reason:
      "Blocked: git -C <path>. Run bare git from the current cwd (already the right root) or use the EnterWorktree tool. git -C causes cwd drift and stale reads. (git -c <key>=<value> for config is allowed.)",
  },
  {
    // RETAINED under the trial (rin-requirements 3.2): re-cloning is a
    // higher-blast-radius failure and is not part of the friction complaint.
    // `relaxable: false` keeps it denying even when the token names this guard.
    name: "git-clone-rin",
    relaxable: false,
    pattern: /(?:^|&&|\|\||[\n;&|(`])\s*git\s+clone\b.*\brin\b/i,
    reason:
      "Blocked: re-cloning the rin monorepo. Worktrees already exist under .claude/worktrees - list them with `git worktree list` and use the EnterWorktree tool. Re-cloning into a new folder is the documented source of stale-file confusion.",
  },
];

const main = async () => {
  const rawInput = await readStdin();
  if (rawInput.trim() === "") process.exit(0);
  const invocation = JSON.parse(rawInput);
  const toolName = invocation.tool_name;
  if (toolName !== "Bash" && toolName !== "PowerShell") process.exit(0);
  const command = invocation.tool_input?.command ?? "";
  const breach = navigationRules.find((navigationRule) =>
    navigationRule.pattern.test(command),
  );
  if (!breach) process.exit(0);
  // The relax branch is the deny branch: one line is written exactly where the
  // deny would have fired, so the measured set cannot drift from the patterns.
  if (breach.relaxable !== false && thisGuardIsRelaxed()) {
    recordDenyShadow({ rule: breach.name, command });
    process.exit(0);
  }
  denyCall({ reason: breach.reason });
};

main().catch(() => process.exit(0));
