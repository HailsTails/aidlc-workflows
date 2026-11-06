// Pure command grammar. This module observes syntax, never authority or workflow state.
import { SWITCHABLE_GUARD_FENCES, guardFenceConfigKey } from "./aidlc-guard-fences.ts";

export const WORKSPACE_VERBS: ReadonlySet<string> = new Set([
  "space",
  "space-create",
  "intent",
]);
export const ORCHESTRATOR_VERBS: ReadonlySet<string> = new Set([
  "park",
  "team-board",
]);

export const NEXT_VALUELESS_FLAGS: ReadonlySet<string> = new Set([
  "--resume",
  "--single",
  "--new-intent",
  "--new-scope",
  "--continue",
  "--change",
  "--every-unit",
  "--unit-plan",
  // Retired, still taken so the token never becomes task text.
  "--init",
  "--force",
]);

/**
 * Whether the token after a flag on a `next` line is that flag's value rather
 * than a word of the person's: the next token that is not flag-shaped, unless
 * `next` takes the flag with no value.
 */
export function nextFlagTakesFollowing(flag: string, following: string | undefined): boolean {
  return following !== undefined && !following.startsWith("-") && !NEXT_VALUELESS_FLAGS.has(flag);
}

const NEXT_OWN_COMMAND_WORDS: ReadonlySet<string> = new Set([
  ...WORKSPACE_VERBS,
  ...ORCHESTRATOR_VERBS,
  "config",
  "help",
]);

/**
 * Where a request of the person's own begins on a `next` line: at its first
 * bare word (past a leading `compose`, this engine's own verb, as readNextTokens
 * reads it). This engine's own launcher options ride ahead of that word, which
 * is where every caller puts them, so among their words the same token is a
 * word of their request and nothing of theirs is read as a folder to work in or
 * an attempt to claim. The `--` mark already separates their words itself. The
 * dispatcher reads its own options to the same boundary (aidlc.ts
 * theirWordsBegin), so the launcher's two layers take the same tokens.
 */
export function requestWordsBeginAt(rawArgs: readonly string[]): number {
  if (rawArgs[0] !== "next") return Number.POSITIVE_INFINITY;
  // After a flag that takes no value the next word is theirs, whatever it is.
  let theirsNext = false;
  for (let i = 1; i < rawArgs.length; i++) {
    const token = rawArgs[i];
    if (i === 1 && token === "compose") continue;
    if (token === "--") return Number.POSITIVE_INFINITY;
    if (token.startsWith("-")) {
      // A flag's value is never a word of theirs; a flag that takes none takes no word.
      if (nextFlagTakesFollowing(token, rawArgs[i + 1])) i++;
      else if (NEXT_VALUELESS_FLAGS.has(token)) theirsNext = true;
      continue;
    }
    return !theirsNext && NEXT_OWN_COMMAND_WORDS.has(token) ? Number.POSITIVE_INFINITY : i;
  }
  return Number.POSITIVE_INFINITY;
}

/** The options the orchestrator's launcher takes off the line before the subcommand reads it. */
export const ORCHESTRATOR_LAUNCHER_OPTIONS = ["--project-dir", "--aidlc-attempt-id"] as const;

/**
 * The orchestrator's launcher options, taken off `[subcommand, ...args]` the
 * one way aidlc-orchestrate's main() does: each with the token after it, only
 * in front of the `--` mark and of the person's own words (requestWordsBeginAt),
 * and never with the mark as its value. A Copilot claim and the engine hash the
 * line that is left, so both read it here, as do the other hooks that need it.
 */
export function readOrchestratorLauncherOptions(rawArgs: readonly string[]): {
  args: string[];
  /** Where each option it took stands in `rawArgs` (its value is the next token). */
  taken: number[];
  /** Where the subcommand stands, after the options in front of it. */
  verbAt: number;
  /** Where an option stands that it would take but nothing it can take follows. */
  dangling?: number;
  projectDir?: string;
  attemptId?: string;
  conflictingAttemptId: boolean;
} {
  const isOption = (token: string | undefined) =>
    (ORCHESTRATOR_LAUNCHER_OPTIONS as readonly (string | undefined)[]).includes(token);
  let verbAt = 0;
  while (isOption(rawArgs[verbAt]) && rawArgs[verbAt + 1] !== undefined && rawArgs[verbAt + 1] !== "--") verbAt += 2;
  const requestFrom = verbAt + requestWordsBeginAt(rawArgs.slice(verbAt));
  const args: string[] = [];
  const taken: number[] = [];
  let dangling: number | undefined;
  let projectDir: string | undefined;
  let attemptId: string | undefined;
  let conflictingAttemptId = false;
  let literal = false;
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    const value = rawArgs[i + 1];
    if (arg === "--") literal = true;
    const launcher = !literal && i < requestFrom && value !== undefined && value !== "--";
    if (!literal && i < requestFrom && !launcher && isOption(arg)) dangling ??= i;
    if (launcher && arg === "--project-dir") {
      projectDir = value;
      taken.push(i++);
    } else if (launcher && arg === "--aidlc-attempt-id") {
      if (/^[A-Za-z0-9._:-]{1,128}$/.test(value)) {
        if (attemptId !== undefined && attemptId !== value) conflictingAttemptId = true;
        attemptId = value;
      }
      taken.push(i++);
    } else {
      args.push(arg);
    }
  }
  return {
    args,
    taken,
    verbAt,
    ...(dangling === undefined ? {} : { dangling }),
    ...(projectDir === undefined ? {} : { projectDir }),
    ...(attemptId === undefined ? {} : { attemptId }),
    conflictingAttemptId,
  };
}

// aidlc-orchestrate.main's launcher-option extraction before subcommand
// routing (readOrchestratorLauncherOptions); the literal delimiter preserves
// all following intent text. A trailing option without a value stays, as in
// main(). Its one caller (the Kiro CLI agent-v1 row) passes the words after
// `next` without the verb, so their unmarked words are not told apart here.
export function stripOrchestratorLauncherOptions(args: readonly string[]): string[] {
  return readOrchestratorLauncherOptions(args).args;
}

const GUARD_FENCE_CONFIG_KEYS = SWITCHABLE_GUARD_FENCES.map((fence) => guardFenceConfigKey(fence)) as
  ["guard.plan-approval", "guard.review-freeze", "guard.state-transition", "guard.reviewer-scope"];
export const CONFIG_KEYS = [
  "depth",
  "test-strategy",
  "review",
  "guard-policy",
  "sensors",
  "learnings",
  "summary-confirmation",
  "plan-approval",
  "collaborators",
  ...GUARD_FENCE_CONFIG_KEYS,
] as const;

export const FORWARD_RESULTS = new Set(["approved", "completed", "complete", "done"]);
// The forward results that claim completion rather than name an approval.
export const COMPLETION_RESULTS = new Set(["completed", "complete", "done"]);
export const GATE_RESULTS = new Set(["awaiting-approval", "rejected", "revised"]);
export const RESUME_RESULTS = new Set(["resume", "resumed"]);
// The results that carry the person's decision at a gate.
export const SOLO_DECISION_RESULTS = new Set(["approved", "rejected", "revised"]);
export const SKIP_RESULT = "skipped";
export const REPORT_RESULTS = new Set([
  ...FORWARD_RESULTS,
  ...GATE_RESULTS,
  ...RESUME_RESULTS,
  SKIP_RESULT,
]);

export interface ReportFlags {
  result?: string;
  userInput?: string;
  reason?: string;
  rejectFindings?: string[];
  reopenFindings?: string[];
  fixFindings?: string[]; // --fix-finding: an open finding the person asked to have fixed as they approved
  skeletonStance?: string; // the classify round-trip's classified stance
  single?: boolean; // --single: complete the synthetic attempt opened by next --single, never the main pointer
  stage?: string; // --stage <slug>: the acted stage (required under --single; preferred for main workflow reports)
  overrideBlockingSensors?: boolean;
  unit?: string; // --unit <name>: required for team-owned per-unit gates
  park?: boolean; // --park: the person also asked to stop here for now
  message?: string; // --message <id>: the one message of the person's the agent read the decision from
  // --<setting> <value>: a `config set` setting the same reply asked for, written
  // before the approval (settingsBesideDecision).
  settings?: Array<[string, string]>;
  // A re-entry request (--result resumed): the choice the conductor read from
  // the person's words, the stage they named for a jump, and the Units it is
  // for when they named one (--unit) or said every Unit (--every-unit).
  choice?: string;
  target?: string;
  everyUnit?: boolean;
  parseError?: string; // an argument report cannot act on (see parseReportFlags)
}

// Every argument report accepts. Listed in the refusal below so a mistyped
// flag points at the real one instead of vanishing.
const REPORT_FLAGS = [
  "--result",
  "--stage",
  "--unit",
  "--user-input",
  "--reason",
  "--reject-finding",
  "--reopen-finding",
  "--fix-finding",
  "--skeleton-stance",
  "--single",
  "--override-blocking-sensors",
  "--park",
  "--message",
  "--choice",
  "--target",
  "--every-unit",
] as const;

// Extract report's flags. --result is the verdict; --user-input carries the
// choice the conductor read from the person's reply, while --reason carries
// rejection feedback or an early completion reason. --park records that the
// person also asked to stop for now. --message names the one message of theirs
// the decision was read from, when it is not every reply since the last one.
// --skeleton-stance carries the conductor's classified walking-skeleton stance
// (the classify round-trip): it does NOT commit a transition — it records the
// stance so the next `next` resolves the deferred gate.
//
// Anything else is refused through parseError rather than dropped. A dropped
// argument is the worst outcome available: a report carrying a mistyped flag
// (or a flag whose value never arrived) would otherwise commit a DIFFERENT
// transition than the one the operator wrote, silently — a rejection reported
// without its feedback, or a per-unit gate closed against the wrong unit.
export function parseReportFlags(args: readonly string[]): ReportFlags {
  const flags: ReportFlags = {};
  // Keep the FIRST problem: it is the one the operator introduced.
  const refuse = (message: string): void => {
    flags.parseError ??= message;
  };
  const missingValue = (flag: string, value: string): void =>
    refuse(
      `report ${flag} requires ${value}, and none followed it. ` +
        `Re-run the same report with the value supplied.`,
    );
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--result" && i + 1 < args.length) {
      flags.result = args[i + 1];
      i++;
    } else if (a === "--user-input" && i + 1 < args.length) {
      flags.userInput = args[i + 1];
      i++;
    } else if (a === "--reason" && i + 1 < args.length) {
      flags.reason = args[i + 1];
      i++;
    } else if (a === "--reject-finding" && i + 1 < args.length) {
      flags.rejectFindings ??= [];
      flags.rejectFindings.push(args[i + 1]);
      i++;
    } else if (a === "--reopen-finding" && i + 1 < args.length) {
      flags.reopenFindings ??= [];
      flags.reopenFindings.push(args[i + 1]);
      i++;
    } else if (a === "--fix-finding" && i + 1 < args.length) {
      flags.fixFindings ??= [];
      flags.fixFindings.push(args[i + 1]);
      i++;
    } else if (a === "--skeleton-stance" && i + 1 < args.length) {
      flags.skeletonStance = args[i + 1];
      i++;
    } else if (a === "--stage" && i + 1 < args.length) {
      flags.stage = args[i + 1];
      i++;
    } else if (a === "--unit" && i + 1 < args.length) {
      flags.unit = args[i + 1];
      i++;
    } else if (a === "--choice" && i + 1 < args.length) {
      flags.choice = args[i + 1];
      i++;
    } else if (a === "--message" && i + 1 < args.length) {
      flags.message = args[i + 1];
      i++;
    } else if (a === "--target" && i + 1 < args.length) {
      flags.target = args[i + 1];
      i++;
    } else if (a === "--single") {
      flags.single = true;
    } else if (a === "--every-unit") {
      flags.everyUnit = true;
    } else if (a === "--override-blocking-sensors") {
      flags.overrideBlockingSensors = true;
    } else if (a === "--park") {
      flags.park = true;
    } else if (a === "--result") {
      missingValue(a, "an outcome");
    } else if (a === "--user-input") {
      missingValue(a, "the choice the person made");
    } else if (a === "--reason") {
      missingValue(a, "the reason text");
    } else if (a === "--reject-finding") {
      missingValue(a, "a finding id");
    } else if (a === "--reopen-finding") {
      missingValue(a, "a finding id and reason");
    } else if (a === "--fix-finding") {
      missingValue(a, "a finding id");
    } else if (a === "--skeleton-stance") {
      missingValue(a, "<on|off|scope-dependent>");
    } else if (a === "--stage") {
      missingValue(a, "a stage name");
    } else if (a === "--unit") {
      missingValue(a, "a unit name");
    } else if (a === "--choice") {
      missingValue(a, "<resume|redo|jump|fresh>");
    } else if (a === "--message") {
      missingValue(a, "the id of the person's message");
    } else if (a === "--target") {
      missingValue(a, "a stage name");

    } else if (a.startsWith("--") && (CONFIG_KEYS as readonly string[]).includes(a.slice(2))) {
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags.settings ??= [];
        flags.settings.push([a.slice(2), args[i + 1]]);
        i++;
      } else {
        missingValue(a, "the value the person asked for");
      }
    } else if (a !== "--") {
      refuse(
        `report does not accept "${a}". It accepts ${REPORT_FLAGS.join(", ")}, and with an approval the ` +
          `\`config set\` settings the same reply asked for (--plan-approval off). Rejection feedback belongs in --reason.`,
      );
    }
  }
  return flags;
}

export type OrchestratorRequest =
  | { kind: "report"; launcher: ReturnType<typeof readOrchestratorLauncherOptions>; flags: ReportFlags; branch: "single" | "stance" | "resume" | "outcome"; forward: "approval" | "completion" | null }
  | { kind: "invalid"; launcher: ReturnType<typeof readOrchestratorLauncherOptions>; diagnostic: string }
  | { kind: "other"; launcher: ReturnType<typeof readOrchestratorLauncherOptions> };

export function decodeOrchestratorRequest({ argv }: { argv: readonly string[] }): OrchestratorRequest {
  const launcher = readOrchestratorLauncherOptions(argv);
  if (launcher.args[0] !== "report") return { kind: "other", launcher };
  const flags = parseReportFlags(launcher.args.slice(1));
  if (flags.parseError) return { kind: "invalid", launcher, diagnostic: flags.parseError };
  const branch = flags.single ? "single" : flags.skeletonStance !== undefined ? "stance"
    : flags.result && RESUME_RESULTS.has(flags.result) ? "resume" : "outcome";
  const forward = branch === "stance" || branch === "resume" ? null
    : flags.result === "approved" ? "approval"
    : flags.result && COMPLETION_RESULTS.has(flags.result) ? "completion" : null;
  return { kind: "report", launcher, flags, branch, forward };
}
