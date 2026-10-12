// SubagentStop review-scribe for the rin-gates pipeline.
//
// The verdict analog of the receipt scribe. A gate's decorrelated review runs
// its minimum-roster lenses as REAL subagents; this hook fires on each lens
// subagent's stop and captures — from the harness, not the model — the
// unforgeable agent identity plus the lens's output, then writes the aggregate
// verdict the moment the roster is covered. There is no "emit" step for a model
// to remember, and one model cannot fake the roster: four independent subagents
// with four harness-set `agent_type`s must actually stop.
//
// Determinism seam: the harness-set `agent_type` is what makes a capture
// unforgeable, so a report is accepted only from an event that carries it. Two
// do. SubagentStop carries it with the subagent's `last_assistant_message`. A
// PostToolUse fired on the lens's own `SubagentHandback` call carries it too,
// with the report as the tool input and the harness's delivery result.
//
// Claude Code now delivers a subagent's report through that hand-back call and
// ends the subagent on a filler turn ("Delivered."), so on that face the report
// is no longer in `last_assistant_message` (measured live 2026-09-28, record
// 260928-lens-verdict-channel-los). Only the FIRST hand-back per invocation is
// delivered; a later call returns `success: false` and is never a report. A
// resumed agent gets a fresh delivery, and the capture supersession below
// already makes its later word replace its earlier one.
//
// The mechanism is read in review-scribe-lens-report.ts, which turns either
// event into one LensReport. Everything below that seam is harness-neutral: a
// face with no hand-back tool (codex today) reaches it through SubagentStop.
//
// Invoking-checkout resolution (mirrors the scribe): the verdict is git-tracked
// and must land in the record dir of the checkout the review runs in, so the
// record dir resolves from the hook's stdin `cwd`. STATE/TRACE and the per-lens
// capture accumulation are gitignored runtime and stay at the primary via the
// git common dir.
//
// Exit-code contract: ALWAYS exit 0 (advisory producer; the verdict file is the
// signal, the autonomy gate + verdict guard do the blocking). Every invocation
// appends one trace line so a silent no-write is diagnosable from disk.

import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { gateDirSegments } from "../tools/rin-gates/rin-gate-namespace.ts";
import { blockingFindingsWithPolicy } from "../tools/rin-gates/rin-gates-finding-disposition.ts";
import {
  declaredReviewArtifactPathFor,
  declaredReviewerFor,
  loadStageGraphNodes,
  stageGraphPath,
} from "../tools/rin-gates/rin-gates-reviewer-identity.ts";
import {
  configR7OptIn,
  requiresExceptionWhyChains,
} from "../tools/rin-harness-config.ts";
import {
  type LensReport,
  lensReportFromHookPayload,
} from "./review-scribe-lens-report.ts";
import {
  appendReviewSectionToFile,
  type ReceiptOutcome,
  type ReceiptRefusalReason,
  recordEngineReceipt,
  spawnEngineReview,
} from "./rin-gates-engine-receipt.ts";
import {
  extractLensVerdict,
  type LensVerdict,
} from "./rin-gates-lens-verdict.ts";
import {
  type RosterResolution,
  resolveReviewRoster,
} from "./shared-review-roster.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
// Walk up to the enclosing checkout rather than counting directory levels: this
// file is projected into a harness dir whose depth differs per face, so a fixed
// `../..` binds to whatever happens to sit two levels up.
const PROJECT_DIR = ((): string => {
  const ascend = (candidate: string): string => {
    if (existsSync(join(candidate, ".git"))) return candidate;
    const parent = dirname(candidate);
    return parent === candidate ? join(HERE, "..", "..") : ascend(parent);
  };
  return ascend(HERE);
})();

// The primary checkout via the git common dir (a worktree's `.git` is a FILE
// pointing at `<primary>/.git/worktrees/<name>`; the primary's `.git` is a DIR).
// Runtime scratch (trace + capture accumulation) lives here — one home.
const workspaceRootFrom = (checkoutRoot: string): string => {
  const gitPath = join(checkoutRoot, ".git");
  try {
    if (statSync(gitPath).isDirectory()) return checkoutRoot;
    const gitdirLine = readFileSync(gitPath, "utf-8").match(
      /^gitdir:\s*(.+?)\s*$/m,
    );
    if (gitdirLine === null) return checkoutRoot;
    const gitdir = isAbsolute(gitdirLine[1])
      ? gitdirLine[1]
      : resolve(checkoutRoot, gitdirLine[1]);
    const primaryMatch = gitdir
      .replace(/\\/g, "/")
      .match(/^(.*)\/\.git\/worktrees\/[^/]+$/);
    return primaryMatch === null ? checkoutRoot : primaryMatch[1];
  } catch {
    return checkoutRoot;
  }
};

const WORKSPACE_ROOT = workspaceRootFrom(PROJECT_DIR);

// The invoking checkout: nearest ancestor of the hook's stdin `cwd` holding a
// `.git` entry — the checkout the review runs in, where its verdict must land.
const nearestCheckoutAt = (dir: string): string | undefined => {
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? undefined : nearestCheckoutAt(parent);
};

const checkoutRootFromCwd = (cwd: string | undefined): string | undefined =>
  cwd === undefined || cwd === "" ? undefined : nearestCheckoutAt(resolve(cwd));

const space = process.env.RIN_GATES_SPACE ?? "default";

// Test isolation, fail-closed. Every path below that the scribe WRITES to or
// EXECUTES falls back to the real checkout when its variable is unset. That
// fallback is right for a live hook and wrong for a test: a spawner that
// forgets one variable silently writes into the real ledgers and runs the real
// engine, and nothing in a green suite shows it (measured 2026-09-28: every
// findings-gate run appended 24 "engine receipt refused" rows to the real
// discard ledger). Under RIN_GATES_TEST_MODE=1 an unset one is a refusal, so a
// leak fails the test that caused it instead of landing in the checkout.
const IS_TEST_MODE = process.env["RIN_GATES_TEST_MODE"] === "1";

const refuseTestIsolationBreach = (reason: string): never => {
  process.stderr.write(
    `rin-gates review-scribe: TEST ISOLATION BREACH — ${reason}. Under RIN_GATES_TEST_MODE=1 the scribe never falls back to the real checkout; inject it from the test.\n`,
  );
  return process.exit(2);
};

const runtimePathFrom = ({
  variable,
  livePath,
}: {
  readonly variable: string;
  readonly livePath: string;
}): string => {
  const injected = process.env[variable];
  if (injected !== undefined && injected !== "") return injected;
  return IS_TEST_MODE
    ? refuseTestIsolationBreach(`${variable} is not injected`)
    : livePath;
};

// Per-gate minimum reviewer roster, resolved from the shared config both this
// scribe and the autonomy gate read (knowledge/rin-gates/review-verdict-contract.md
// § Minimum roster: the gate's declared `min_lenses`, else the architecture
// default). A gate absent from `byGate` falls through to `defaultRoster`. The
// config lives beside this hook (both are .claude-native) so the two consumers
// cannot drift.
const ROSTER_CONFIG_PATH =
  process.env.RIN_GATES_ROSTER_CONFIG ?? join(HERE, "review-rosters.json");

const isReviewerLens = (agentType: string): boolean =>
  /-reviewer-agent$/.test(agentType);

const TRACE_PATH = runtimePathFrom({
  variable: "RIN_GATES_REVIEW_TRACE_PATH",
  livePath: join(
    WORKSPACE_ROOT,
    "aidlc",
    "rin-gates-review-scribe-trace.jsonl",
  ),
});

const CAPTURES_DIR = runtimePathFrom({
  variable: "RIN_GATES_REVIEW_CAPTURES_DIR",
  livePath: join(WORKSPACE_ROOT, "aidlc", ".rin-gates-review-captures"),
});

// The discard ledger. The trace is an append-only diagnostic of EVERY invocation
// (captures included) and had grown past a thousand entries — a session that
// wanted to know "did this board lose anything?" had to filter it, which is
// exactly what nobody did while 32 verdicts were discarded over three days
// (task 019fe4af). The ledger holds discards ONLY, so reading it is the answer
// to that question rather than the start of an investigation.
const DISCARD_LEDGER_PATH = runtimePathFrom({
  variable: "RIN_GATES_REVIEW_DISCARD_LEDGER_PATH",
  livePath: join(WORKSPACE_ROOT, "aidlc", "rin-gates-review-discards.jsonl"),
});

// The hand-back ledger: one line per lens report delivered through a hand-back.
// A lens that hands back then stops on a filler turn, so its SubagentStop has no
// verdict. Without this ledger every such stop would be discarded loudly, telling
// the convening session its review was thrown away when it was captured seconds
// earlier. Keyed by agent_id, the harness-set id both events carry.
const HANDBACK_LEDGER_PATH = runtimePathFrom({
  variable: "RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH",
  livePath: join(WORKSPACE_ROOT, "aidlc", "rin-gates-review-handbacks.jsonl"),
});

// The engine's own review writer — the receipt bridge spawns it so the engine's
// validation (reviewer-matches-declared, ordinal sequencing, artifact
// fingerprinting, the audit lock) applies to every receipt derived from a board.
const engineLogHarnessRoot = (): string => {
  const parent = dirname(HERE);
  return basename(parent) === "rin" && basename(dirname(parent)) === "plugins"
    ? join(dirname(dirname(parent)), ".claude")
    : parent;
};

const ENGINE_LOG_PATH = runtimePathFrom({
  variable: "RIN_GATES_ENGINE_LOG_PATH",
  livePath: join(engineLogHarnessRoot(), "tools", "aidlc-log.ts"),
});

const nowIso = (): string => new Date().toISOString();

const appendJsonLine = (path: string, entry: Record<string, unknown>): void => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf-8");
  } catch {
    // Deliberately swallowed: this hook's exit-code contract is ALWAYS 0, and a
    // trace line that cannot be written must not take the review down with it.
  }
};

const writeTraceLine = (entry: Record<string, unknown>): void => {
  appendJsonLine(TRACE_PATH, { at: nowIso(), ...entry });
};

const exitTraced = (entry: Record<string, unknown>): never => {
  writeTraceLine(entry);
  process.exit(0);
};

// EVERY discard exits through here — there is no silent path left. A discarded
// lens verdict is a review that was paid for and thrown away, so it is loud on
// stderr (where the convening session sees it live) AND durable in the ledger
// (where a later session can read what a board lost). The fail-safe direction is
// unchanged: a discarded verdict is never counted toward the roster, so a
// discarded NOT-READY can never become a READY — it withholds the aggregate
// entirely and the gate refuses the approve.
const exitDiscarded: (input: {
  readonly reason: string;
  readonly remedy: string;
  readonly entry: Record<string, unknown>;
}) => never = ({ reason, remedy, entry }) => {
  const agentType =
    typeof entry.agentType === "string" ? entry.agentType : "a reviewer lens";
  process.stderr.write(
    `rin-gates review-scribe: DISCARDED ${agentType}'s review — ${reason}. ` +
      `Its verdict CANNOT be counted toward the roster, so the gate will refuse the approve. ${remedy} ` +
      `Ledger: ${DISCARD_LEDGER_PATH}\n`,
  );
  appendJsonLine(DISCARD_LEDGER_PATH, {
    at: nowIso(),
    reject: reason,
    ...entry,
  });
  writeTraceLine({ reject: reason, ...entry });
  process.exit(0);
};

// A refused engine receipt is the same class of loss as a discarded lens and gets
// the same treatment: loud on stderr where the convening session sees it live,
// durable in the same ledger where a later session reads what a board lost. It
// was previously written only into the gitignored trace, so a converged READY
// board whose receipt never landed looked identical to one whose receipt did —
// while the engine's reviewer floor was left resting on an older receipt.
// Non-fatal by design: the scribe's exit-code contract stays advisory, and the
// engine independently refuses the approve if its own floor is genuinely unmet.
const reportRefusedReceipt = (args: {
  readonly gate: string;
  readonly reviewer: string | null;
  readonly receipt: {
    readonly step: "requested" | "completed";
    readonly reason: ReceiptRefusalReason;
    readonly detail: string;
  };
}): void => {
  const reviewer = args.reviewer ?? "the gate's declared reviewer";
  process.stderr.write(
    `rin-gates review-scribe: the engine REFUSED the ${args.gate} receipt for ${reviewer} ` +
      `at the ${args.receipt.step} step (${args.receipt.reason}). ` +
      "Engine receipt NOT recorded — the engine's reviewer floor may rest on a stale receipt; " +
      `see the discard ledger. Engine said: ${args.receipt.detail} ` +
      `Ledger: ${DISCARD_LEDGER_PATH}\n`,
  );
  appendJsonLine(DISCARD_LEDGER_PATH, {
    at: nowIso(),
    reject: "engine receipt refused",
    gate: args.gate,
    reviewer: args.reviewer,
    step: args.receipt.step,
    reason: args.receipt.reason,
    detail: args.receipt.detail,
  });
};

const captureSchema = z.object({
  lens: z.string(),
  verdict: z.string(),
  findings: z.array(z.string()),
  sessionId: z.string(),
  at: z.string(),
  agentId: z.string().optional(),
  channel: z.enum(["handback", "stop-message"]).optional(),
  reportText: z.string().optional(),
}).readonly();

type Capture = z.infer<typeof captureSchema>;

const readStdin = (): Promise<string> =>
  new Promise((resolvePromise) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolvePromise(raw));
  });

const intentsRoot = (checkoutRoot: string): string =>
  join(checkoutRoot, "aidlc", "spaces", space, "intents");

const activeRecordDir = (checkoutRoot: string): string | null => {
  const cursorPath = join(intentsRoot(checkoutRoot), "active-intent");
  if (!existsSync(cursorPath)) return null;
  const dirName = readFileSync(cursorPath, "utf8").trim();
  if (dirName === "") return null;
  const recordDir = join(intentsRoot(checkoutRoot), dirName);
  return existsSync(recordDir) ? recordDir : null;
};

const fieldFrom = (content: string, label: string): string | null => {
  const match = content.match(new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*(.+)`));
  return match ? match[1].trim() : null;
};

// Under repo-SoR the engine record dir IS the intent's identity — there is no
// slice-binding.json to consult. The dir NAME (the engine's `<YYMMDD>-<slug>`)
// is the stable per-intent key the captures file + verdict stamp are named by.
// Property unchanged from the old taskId key: it isolates one intent's captures
// from another's; only the naming source moved from the DB binding to the record.
const recordNameOf = (recordDir: string): string | null => {
  const name = basename(recordDir);
  return name === "" ? null : name;
};

const currentGate = (recordDir: string): string | null => {
  const statePath = join(recordDir, "aidlc-state.md");
  if (!existsSync(statePath)) return null;
  return fieldFrom(readFileSync(statePath, "utf8"), "Current Stage");
};

const headShaOf = (checkoutRoot: string): string | null => {
  if (process.env.RIN_GATES_TEST_MODE === "1") {
    const injected = process.env.RIN_GATES_HEAD_SHA;
    if (injected !== undefined) return injected === "" ? null : injected;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: checkoutRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const sha = result.stdout?.trim();
  return result.status === 0 && sha ? sha : null;
};

// A lens proves its tree by naming the reviewed sha anywhere in its output. An
// abbreviation is accepted down to 8 hex chars — that is how humans and models
// quote a sha, and the binding property is unchanged: the lens could only have
// obtained it from the prompt that pinned its checkout. Shorter prefixes are
// refused because they stop being distinguishing.
const SHA_CANDIDATE = /\b[0-9a-f]{8,40}\b/gi;

const echoesHeadSha = (
  message: string | undefined,
  headSha: string,
): boolean => {
  if (message === undefined) return false;
  return [...message.matchAll(SHA_CANDIDATE)].some((match) =>
    headSha.startsWith(match[0].toLowerCase()),
  );
};

// A lens that cannot confirm which tree it read must abstain rather than guess.
// The abstention is a first-class outcome, not a malformed verdict: it is
// recorded as a discard (so the roster stays uncovered and the gate refuses)
// and it is loud, so the convening session re-dispatches with a pinned cwd.
//
// An abstention is a DECLARATION, matched at line start (optionally behind a
// heading, bold, or bullet marker) — the same principle the extractor already
// ratifies for the verdict token itself. Keyword-sniffing the whole message
// discarded 62 ledger rows whose lenses merely NAMED the token while delivering
// a well-formed verdict ("this is not a CANNOT-REVIEW case").
const ABSTENTION_DECLARATION =
  /^[ \t]*(?:#{1,6}[ \t]*|\*\*[ \t]*|[-*][ \t]+)?CANNOT[\s_-]?REVIEW\b/im;

const reviewRosterFor = (gate: string): RosterResolution =>
  resolveReviewRoster({ configPath: ROSTER_CONFIG_PATH, gate });

// Extraction is owned by rin-gates-lens-verdict.ts (task 019fd9a5): the TOOL
// derives the verdict from what the lens natively produces, rather than the lens
// being asked to reproduce an exact delimiter pair as free text. That step was
// losing 399 of 887 captures — every lens, in three different malformations, even
// with the exact template pasted into the agent definition. Extraction is
// fail-safe toward NOT-READY, so widening the accepted shapes cannot manufacture
// an approval.

const capturesPath = ({
  recordName,
  gate,
  headSha,
}: {
  readonly recordName: string;
  readonly gate: string;
  readonly headSha: string;
}): string => join(CAPTURES_DIR, `${recordName}.${gate}.${headSha}.jsonl`);

const appendCapture = (path: string, capture: Capture): void => {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(capture)}\n`, "utf-8");
};

const readCaptures = (path: string): readonly Capture[] => {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): Capture | null => {
      try {
        const capture = captureSchema.safeParse(JSON.parse(line));
        return capture.success ? capture.data : null;
      } catch {
        return null;
      }
    })
    .filter((capture): capture is Capture => capture !== null);
};

// A board re-reviews at the same head (task 019fef05). The captures file is
// already partitioned by headSha, so a round at a NEW commit lands in a new file
// and cannot reach this. What had no supersession was a re-review at the SAME
// head — a lens re-reporting after a fix it could verify without a new commit.
//
// A capture is SUPERSEDED when the same lens has spoken again later in this same
// file. Supersession is per-lens and strictly by that lens's own later word: a
// lens that refused and never revisited is never superseded by anyone else's
// READY, which is what keeps a single genuine refusal blocking.
//
// This returns the whole capture rather than a verdict token because the verdict
// and its findings must retire TOGETHER. Retiring the token alone was the second
// half of the same defect: the findings gate re-harvested a superseded round's
// citations, so the aggregate stayed blocked on a finding no live verdict made.
const liveCaptures = (captures: readonly Capture[]): readonly Capture[] => [
  ...new Map(captures.map((capture) => [capture.lens, capture])).values(),
];

const latestVerdictForLens = (
  captures: readonly Capture[],
  lens: string,
): string | null => {
  const forLens = captures.filter((capture) => capture.lens === lens);
  return forLens.length === 0 ? null : forLens[forLens.length - 1].verdict;
};

// The aggregate the board's captures add up to, lifted out of `main` so the
// orchestrator composes named steps rather than deriving this inline.
//
// Every clause reads the LIVE captures — each lens's latest word at this head.
// `anyNotReady` previously scanned the raw file, so a round-1 refusal outvoted
// the same lens's own round-2 READY forever and the aggregate could never return
// to READY without a new commit (task 019fef05).
//
// The findings gate (task 019f6d3e): a lens's verdict TOKEN was once the only
// input, so a lens writing READY above its own cited violations aggregated to
// READY — the laundering Step 5 forbids but nothing checked. Fail-safe in one
// direction only: an undisposed finding can move the aggregate to NOT-READY and
// can never move it to READY. Read from the live captures for the same reason a
// verdict is — a finding belongs to the round that cited it, so a superseded
// round's findings retire with its verdict.
const aggregateVerdictOf = ({
  captures,
  roster,
  exceptionWhyChainsEnabled,
}: {
  readonly captures: readonly Capture[];
  readonly roster: readonly string[];
  readonly exceptionWhyChainsEnabled: boolean;
}): {
  readonly live: readonly Capture[];
  readonly aggregate: "READY" | "NOT-READY";
  readonly blockingFindings: readonly string[];
} => {
  const live = liveCaptures(captures);
  const rosterAllReady = roster.every(
    (lens) => latestVerdictForLens(captures, lens) === "READY",
  );
  const anyNotReady = live.some((capture) => capture.verdict === "NOT-READY");
  const blockingFindings = blockingFindingsWithPolicy({
    findings: live.flatMap((capture) => capture.findings),
    exceptionWhyChainsEnabled,
  });
  return {
    live,
    aggregate:
      rosterAllReady && !anyNotReady && blockingFindings.length === 0
        ? "READY"
        : "NOT-READY",
    blockingFindings,
  };
};

type ReviewContext = {
  readonly agentType: string;
  readonly checkoutRoot: string;
  readonly recordDir: string;
  readonly recordName: string;
  readonly gate: string;
  readonly gateSegments: readonly string[];
};

const parsedStdinPayload = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return process.exit(0);
  }
};

const lensReportFromStdin = async (): Promise<LensReport> => {
  if (process.stdin.isTTY) process.exit(0);
  const raw = await readStdin();
  if (raw.trim() === "") process.exit(0);
  const intake = lensReportFromHookPayload({
    payload: parsedStdinPayload(raw),
  });
  switch (intake.kind) {
    case "report":
      return intake.report;
    case "undelivered-handback":
      if (!isReviewerLens(intake.agentType)) process.exit(0);
      return exitTraced({
        outcome:
          "hand-back not delivered; the lens's first hand-back is its report",
        agentType: intake.agentType,
      });
    case "not-a-lens-report":
      return process.exit(0);
  }
};

const handbackLedgerRowSchema = z.object({ agentId: z.string() });

const ledgerRowAgentId = (line: string): string | null => {
  try {
    const row = handbackLedgerRowSchema.safeParse(JSON.parse(line));
    return row.success ? row.data.agentId : null;
  } catch {
    return null;
  }
};

const handbackDeliveredFor = (agentId: string): boolean => {
  if (agentId === "" || !existsSync(HANDBACK_LEDGER_PATH)) return false;
  return readFileSync(HANDBACK_LEDGER_PATH, "utf-8")
    .split("\n")
    .some((line) => ledgerRowAgentId(line) === agentId);
};

const recordHandbackDelivered = (report: LensReport): void => {
  if (report.channel !== "handback") return;
  appendJsonLine(HANDBACK_LEDGER_PATH, {
    at: nowIso(),
    agentId: report.agentId,
    agentType: report.agentType,
  });
};

const reviewContextFor = ({
  report,
}: {
  readonly report: LensReport;
}): ReviewContext => {
  const agentType = report.agentType;
  if (!isReviewerLens(agentType)) process.exit(0);
  const checkoutRoot = checkoutRootFromCwd(report.cwd) ?? WORKSPACE_ROOT;
  if (
    IS_TEST_MODE &&
    (checkoutRoot === WORKSPACE_ROOT || checkoutRoot === PROJECT_DIR)
  ) {
    refuseTestIsolationBreach(
      `the invoking checkout resolved to the real repository (${checkoutRoot}), whose active-intent cursor and record dirs a test must never read or write`,
    );
  }
  const recordDir = activeRecordDir(checkoutRoot);
  if (recordDir === null) {
    return exitDiscarded({
      reason: "no active intent at invoking checkout",
      remedy: `Set the cursor (\`aidlc/spaces/<space>/intents/active-intent\`) to a record dir that exists in ${checkoutRoot}, then re-dispatch the board.`,
      entry: {
        agentType,
        channel: report.channel,
        cwd: report.cwd ?? null,
        checkoutRoot,
      },
    });
  }
  const recordName = recordNameOf(recordDir);
  const gate = currentGate(recordDir);
  if (recordName === null || gate === null) {
    return exitDiscarded({
      reason: "no record name or no Current Stage",
      remedy:
        "The record dir resolved but carries no readable `**Current Stage**` in aidlc-state.md — repair the record, then re-dispatch.",
      entry: { agentType, recordName, gate },
    });
  }
  const gateSegments = gateDirSegments(gate);
  if (gateSegments === null) {
    return exitDiscarded({
      reason: "gate has no phase mapping",
      remedy: `The record's Current Stage (\`${gate}\`) maps to no phase dir, so there is nowhere to write the verdict. Fix the stage slug in aidlc-state.md, then re-dispatch.`,
      entry: { agentType, gate },
    });
  }
  return { agentType, checkoutRoot, recordDir, recordName, gate, gateSegments };
};

const lensVerdictFor = ({
  report,
  context,
}: {
  readonly report: LensReport;
  readonly context: ReviewContext;
}): LensVerdict => {
  const block = extractLensVerdict(report.reportText);
  if (block === null) {
    if (
      report.channel === "stop-message" &&
      handbackDeliveredFor(report.agentId)
    ) {
      return exitTraced({
        outcome:
          "stop after a delivered hand-back; the hand-back was the report",
        agentType: context.agentType,
        agentId: report.agentId,
        gate: context.gate,
      });
    }
    if (ABSTENTION_DECLARATION.test(report.reportText ?? "")) {
      return exitDiscarded({
        reason: "lens abstained with CANNOT-REVIEW",
        remedy:
          "The lens could not confirm which tree it was reading. Pin its cwd to the reviewed checkout, pass the head sha in its prompt, then re-dispatch.",
        entry: { agentType: context.agentType, gate: context.gate },
      });
    }
    return exitDiscarded({
      reason: "no verdict in lens output",
      remedy:
        "Re-dispatch this lens and have its report (its hand-back message, or its final message on a face with no hand-back) carry a `## Verdict` section stating READY or NOT-READY.",
      entry: {
        agentType: context.agentType,
        channel: report.channel,
        gate: context.gate,
      },
    });
  }
  if (block.gate !== null && block.gate !== context.gate) {
    return exitDiscarded({
      reason: "lens gate mismatch",
      remedy: `The lens declared gate \`${block.gate}\` but the record's Current Stage is \`${context.gate}\` — it reviewed against a different gate's rubric. Re-dispatch it for ${context.gate}.`,
      entry: {
        agentType: context.agentType,
        declared: block.gate,
        resolved: context.gate,
      },
    });
  }
  return block;
};

const reviewedHeadShaFor = ({
  report,
  context,
  block,
}: {
  readonly report: LensReport;
  readonly context: ReviewContext;
  readonly block: LensVerdict;
}): string => {
  const headSha = headShaOf(context.checkoutRoot);
  if (headSha === null) {
    return exitDiscarded({
      reason: "cannot resolve HEAD sha",
      remedy: `\`git rev-parse HEAD\` failed in ${context.checkoutRoot}, so the verdict cannot be bound to a commit. Re-dispatch from a valid checkout.`,
      entry: { agentType: context.agentType, gate: context.gate },
    });
  }
  if (block.verdict === "READY" && !echoesHeadSha(report.reportText, headSha)) {
    return exitDiscarded({
      reason: "verdict does not echo the reviewed head sha",
      remedy: `A READY must prove which tree it read: state the reviewed head sha (${headSha}) in the verdict. Dispatch each lens with its cwd pinned to the reviewed checkout and its head sha in the prompt, then re-dispatch.`,
      entry: { agentType: context.agentType, gate: context.gate, headSha },
    });
  }
  return headSha;
};

const captureBoardReview = ({
  report,
  context,
  block,
  headSha,
}: {
  readonly report: LensReport;
  readonly context: ReviewContext;
  readonly block: LensVerdict;
  readonly headSha: string;
}): {
  readonly captures: readonly Capture[];
  readonly roster: readonly string[];
} => {
  const path = capturesPath({
    recordName: context.recordName,
    gate: context.gate,
    headSha,
  });
  appendCapture(path, {
    lens: context.agentType,
    verdict: block.verdict,
    findings: [...block.findings],
    sessionId: report.sessionId,
    agentId: report.agentId,
    channel: report.channel,
    reportText: report.reportText,
    at: nowIso(),
  });
  writeTraceLine({
    outcome: "captured",
    agentType: context.agentType,
    gate: context.gate,
    verdict: block.verdict,
    channel: block.channel,
    reportChannel: report.channel,
  });
  const captures = readCaptures(path);
  const resolution = reviewRosterFor(context.gate);
  if (resolution.kind === "unreadable") {
    return exitTraced({
      outcome: `roster unreadable: ${resolution.reason}`,
      agentType: context.agentType,
      gate: context.gate,
      recordName: context.recordName,
      captured: captures.map((capture) => capture.lens),
      roster: [],
    });
  }
  const roster = resolution.roster;
  const covered = roster.every(
    (lens) => latestVerdictForLens(captures, lens) !== null,
  );
  if (!covered) {
    return exitTraced({
      outcome: "captured, roster incomplete",
      agentType: context.agentType,
      gate: context.gate,
      recordName: context.recordName,
      captured: captures.map((capture) => capture.lens),
      roster,
    });
  }
  return { captures, roster };
};

const writeAggregateVerdict = ({
  context,
  headSha,
  captures,
  roster,
}: {
  readonly context: ReviewContext;
  readonly headSha: string;
  readonly captures: readonly Capture[];
  readonly roster: readonly string[];
}): {
  readonly aggregate: "READY" | "NOT-READY";
  readonly lenses: readonly string[];
} => {
  const optIn = configR7OptIn({ projectDir: context.checkoutRoot });
  if (optIn.kind === "invalid") {
    return exitDiscarded({
      reason: "harness.config.json is invalid",
      remedy: optIn.reason,
      entry: { agentType: context.agentType, gate: context.gate },
    });
  }
  const { live, aggregate, blockingFindings } = aggregateVerdictOf({
    captures,
    roster,
    exceptionWhyChainsEnabled: requiresExceptionWhyChains({ optIn }),
  });
  const gateDir = join(context.recordDir, ...context.gateSegments);
  mkdirSync(gateDir, { recursive: true });
  const verdict = {
    gate: context.gate,
    taskId: context.recordName,
    headSha,
    verdict: aggregate,
    lenses: [...new Set(live.map((capture) => capture.lens))],
    findings: live.flatMap((capture) => capture.findings),
    blockingFindings,
    reports: live.map((capture) => ({
      ...capture,
      gate: context.gate,
      headSha,
      reportText: capture.reportText ?? null,
      agentId: capture.agentId ?? null,
      channel: capture.channel ?? null,
    })),
    reportsComplete: live.every((capture) => typeof capture.reportText === "string" && capture.reportText.trim() !== ""),
    emittedBy: "rin-gates-review-scribe",
    reviewedAt: nowIso(),
    ["$note"]:
      "Written by the SubagentStop review-scribe when the minimum lens roster was covered. The `taskId` field carries the engine record dir NAME (the intent's identity under repo-SoR — there is no DB Slice binding). `findings` and `lenses` report each lens's LATEST review at this headSha: a lens that re-reviews at the same head supersedes its own earlier round, verdict and findings together, so a fixed round-1 refusal cannot pin the aggregate forever. Supersession is per-lens and never cross-lens — an unrevisited NOT-READY still blocks. `blockingFindings` are the live cited findings no lens disposed; a non-empty list forces NOT-READY however each lens worded its own verdict token. Never hand-written — the verdict guard denies Write/Edit/bash into review-verdict.json. The reports preserve each latest native report and its provenance as data. Missing historical report text is explicit; re-dispatch before synthesizing a modern findings report. The conductor writes its exact pending request.reviewFile and runs the returned recordVerdict; this aggregate is not an engine review record.",
  };
  writeFileSync(
    join(gateDir, "review-verdict.json"),
    `${JSON.stringify(verdict, null, 2)}\n`,
    "utf-8",
  );
  return { aggregate, lenses: verdict.lenses };
};

const engineReceiptFor = ({
  context,
  aggregate,
}: {
  readonly context: ReviewContext;
  readonly aggregate: "READY" | "NOT-READY";
}): ReceiptOutcome => {
  const stageGraph = loadStageGraphNodes(stageGraphPath());
  const declaredReviewer = declaredReviewerFor({
    gate: context.gate,
    graph: stageGraph,
  });
  const route = z.enum(["conductor-report", "legacy-append"]).default("conductor-report").safeParse(process.env.RIN_GATES_ENGINE_REVIEW_ROUTE);
  const receipt: ReceiptOutcome = route.success
    ? recordEngineReceipt({
        route: route.data,
        projectDir: context.checkoutRoot,
        gate: context.gate,
        declaredReviewer,
        aggregate,
        invokeEngine: spawnEngineReview({ enginePath: ENGINE_LOG_PATH }),
        appendReviewSection: appendReviewSectionToFile({
          resolveArtifactPath: ({ stage }) => {
            const logical = declaredReviewArtifactPathFor({ gate: stage, graph: stageGraph });
            return logical === null ? null : join(context.recordDir, logical);
          },
        }),
      })
    : {
        kind: "refused",
        step: "requested",
        reason: "other",
        detail: "RIN_GATES_ENGINE_REVIEW_ROUTE must be conductor-report or legacy-append.",
      };
  if (receipt.kind === "refused") {
    reportRefusedReceipt({
      gate: context.gate,
      reviewer: declaredReviewer,
      receipt,
    });
  }
  return receipt;
};

const main = async (): Promise<void> => {
  const report = await lensReportFromStdin();
  const context = reviewContextFor({ report });
  recordHandbackDelivered(report);

  const block = lensVerdictFor({ report, context });
  const headSha = reviewedHeadShaFor({ report, context, block });

  const { captures, roster } = captureBoardReview({
    report,
    context,
    block,
    headSha,
  });
  const { aggregate, lenses } = writeAggregateVerdict({
    context,
    headSha,
    captures,
    roster,
  });

  const receipt = engineReceiptFor({ context, aggregate });
  exitTraced({
    outcome: "verdict-written",
    verdict: aggregate,
    gate: context.gate,
    recordName: context.recordName,
    headSha,
    lenses,
    checkoutRoot: context.checkoutRoot,
    receipt,
  });
};

main().catch(() => process.exit(0));
