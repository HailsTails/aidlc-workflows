// The reviewer bridge (FR-6, member 01a02cd6): ONE review satisfies BOTH gates.
//
// Every rin gate has had to satisfy two unrelated reviewer mechanisms that share
// no verdict, no roster, and no writer:
//
//   - the rin decorrelated BOARD — N lens subagents whose harness-set identities
//     the SubagentStop scribe aggregates into review-verdict.json, enforced by
//     rin-gates-autonomy-gate.ts;
//   - the ENGINE's declared `reviewer:` — a fresh terminal REVIEW_COMPLETED whose
//     Reviewer field equals the stage's declared identity, enforced by
//     verifyReviewerPrecondition in aidlc-state.ts.
//
// With both live and unbridged, the only way a lane completed a gate was to hand-
// record the engine receipt with `aidlc-log.ts review --verdict` — a FREE WRITE
// asserting both identity and verdict, strictly weaker than the board it
// duplicates. Q1(b) resolves it in the board's favour: the receipt becomes a
// DERIVED CONSEQUENCE of a converged board, so the receipt gains a legitimate
// unforgeable writer and nothing gains a bypass.
//
// THE RECEIPT IS A CONSEQUENCE OF CONVERGENCE, NEVER A SIDE DOOR. This module is
// called from exactly one place — the point at which the scribe has already
// decided the roster is covered and is writing the aggregate. A non-converged
// board never reaches it, so no receipt exists for a board that did not converge.
// The verdict MIRRORS the aggregate: a NOT-READY aggregate records a NOT-READY
// receipt (the engine is soft on the verdict and hard on the review HAVING
// HAPPENED; the autonomy gate is what refuses a NOT-READY approve).
//
// WHY IT SPAWNS THE ENGINE'S OWN WRITER rather than appending audit blocks. The
// engine's `review` subcommand owns real validation this bridge must not
// reimplement or evade: reviewer-matches-declared, ordinal sequencing, the
// artifact fingerprint taken at REVIEW_REQUESTED and re-checked at
// REVIEW_COMPLETED, and the audit lock. Writing blocks directly would also be
// denied by the audit-path guard, correctly. So the bridge invokes the engine and
// reports what the engine said.
//
// ORDERING, and why it satisfies the engine's freshness floors. freshReviewReceipts
// invalidates a receipt on any later produces[] write, and REVIEW_COMPLETED is
// refused outright if the declared artifacts changed since its REVIEW_REQUESTED.
// The board is convened AFTER the gate's artefacts are written and reviews those
// bytes, so at convergence time the last produces[] write already precedes the
// pair. The pair is emitted back-to-back under that condition, which is exactly
// the window the engine asks for.

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { z } from "zod";

export type EngineReviewRoute = "conductor-report" | "legacy-append";

export type BoardVerdictToken = "READY" | "NOT-READY";

// Why a refusal is NAMED rather than reported as one undifferentiated failure.
// The engine refuses a review request for two structurally different reasons and
// only one of them carries an ordinal to recover to. The recovery-spent shape
// means the engine will accept NO further receipt in this review attempt, so the
// engine's reviewer floor is left resting on an older, possibly stale receipt —
// a materially different situation from a transient refusal, and the caller
// cannot warn about it if the bridge collapses both into "refused".
export type ReceiptRefusalReason =
  | "out-of-sequence-unrecovered"
  | "recovery-spent"
  | "other";

export type ReceiptOutcome =
  | {
      readonly kind: "conductor-report";
      readonly reviewer: string;
      readonly verdict: BoardVerdictToken;
    }
  | {
      readonly kind: "recorded";
      readonly reviewer: string;
      readonly iteration: number;
    }
  | { readonly kind: "no-declared-reviewer" }
  | {
      readonly kind: "refused";
      readonly step: "requested" | "completed";
      readonly reason: ReceiptRefusalReason;
      readonly detail: string;
    };

export type EngineInvocation = (args: {
  readonly projectDir: string;
  readonly stage: string;
  readonly reviewer: string;
  readonly iteration: number;
  readonly verdict: BoardVerdictToken | null;
}) => { readonly ok: boolean; readonly output: string };

// AIDLC 2.7.0 makes the reviewer's `## Review` section the receipt's evidence:
// REVIEW_REQUESTED binds the artefact's exact pre-append bytes, and
// REVIEW_COMPLETED is refused unless the bytes appended since then are exactly
// one terminal `## Review` section carrying one each of Verdict / Reviewer /
// Iteration. The board is the reviewer here, so the bridge appends that section
// on its behalf between the two calls — without it the engine refuses every
// receipt this bridge produces, whatever the board decided.
export type ReviewSectionAppend = (args: {
  readonly projectDir: string;
  readonly stage: string;
  readonly section: string;
}) => { readonly ok: boolean; readonly detail: string };

// The canonical authority lines are bold PARAGRAPHS, never table or list rows.
// The engine renders `table: () => ""` and `list: () => ""` when it extracts
// authority, so a verdict written inside either renders to nothing and the
// completion is refused for carrying no canonical verdict line. Anything richer
// the board wants to say belongs in H3+ subsections beneath these three lines.
export const reviewSectionFor = (args: {
  readonly verdict: BoardVerdictToken;
  readonly reviewer: string;
  readonly iteration: number;
}): string =>
  [
    "## Review",
    "",
    `**Verdict:** ${args.verdict}`,
    "",
    `**Reviewer:** ${args.reviewer}`,
    "",
    `**Iteration:** ${args.iteration}`,
    "",
  ].join("\n");

// The engine's out-of-sequence refusal names the ordinal it wants. A board that
// re-reviews at the same head legitimately records a second receipt, so the
// bridge must reach the right ordinal rather than assume the first.
const LEGACY_EXPECTED_ORDINAL =
  /Refusing REVIEW_REQUESTED for "([^"]+)": iteration ([1-9][0-9]*) is out of sequence; expected ([1-9][0-9]*) from the current audit attempt/;
const MODERN_EXPECTED_ORDINAL =
  /Cannot start review iteration ([1-9][0-9]*) for "([^"]+)" because the next iteration is ([1-9][0-9]*)\. Retry with --iteration ([1-9][0-9]*)/;
const engineMessageIn = (output: string): string => {
  try {
    const envelope: unknown = JSON.parse(output);
    if (
      typeof envelope === "object" &&
      envelope !== null &&
      !Array.isArray(envelope) &&
      "error" in envelope &&
      typeof envelope.error === "string"
    ) {
      return envelope.error;
    }
  } catch {}
  return output;
};

const expectedOrdinalIn = (args: {
  readonly output: string;
  readonly stage: string;
  readonly requestedIteration: number;
}): number | null => {
  const message = engineMessageIn(args.output);
  const legacy = message.match(LEGACY_EXPECTED_ORDINAL);
  if (
    legacy !== null &&
    legacy[1] === args.stage &&
    Number(legacy[2]) === args.requestedIteration
  ) {
    return Number(legacy[3]);
  }
  const modern = message.match(MODERN_EXPECTED_ORDINAL);
  if (
    modern !== null &&
    Number(modern[1]) === args.requestedIteration &&
    modern[2] === args.stage &&
    modern[3] === modern[4]
  ) {
    return Number(modern[3]);
  }
  return null;
};

// The engine's stale-receipt recovery refusals — reviewRecoverySpentMessage and
// reviewRecoveryAlreadyRequestedMessage in .claude/tools/aidlc-log.ts — share
// this phrase and nothing else does. Both mean the same thing to this bridge:
// the one recovery pass for this review attempt is gone, so no further receipt
// can be recorded and only a human GATE_REJECTED resets the attempt.
const RECOVERY_SPENT = /the one stale-receipt recovery/;

const refusalReasonIn = (output: string): ReceiptRefusalReason => {
  const message = engineMessageIn(output);
  if (RECOVERY_SPENT.test(message)) return "recovery-spent";
  if (
    LEGACY_EXPECTED_ORDINAL.test(message) ||
    MODERN_EXPECTED_ORDINAL.test(message)
  ) {
    return "out-of-sequence-unrecovered";
  }
  return "other";
};

const legacyRequestSchema = z.object({
  emitted: z.literal("REVIEW_REQUESTED"),
  stage: z.string(),
  reviewFile: z.never().optional(),
  recordVerdict: z.never().optional(),
});

const supportedLegacyRequest = (input: {
  readonly output: string;
  readonly stage: string;
}): boolean => {
  try {
    const decoded = legacyRequestSchema.safeParse(JSON.parse(input.output));
    return decoded.success && decoded.data.stage === input.stage;
  } catch {
    return false;
  }
};

const FIRST_ITERATION = 1;

const completeReceipt = (input: {
  readonly args: {
    readonly projectDir: string;
    readonly gate: string;
    readonly aggregate: BoardVerdictToken;
    readonly invokeEngine: EngineInvocation;
    readonly appendReviewSection: ReviewSectionAppend;
  };
  readonly reviewer: string;
  readonly iteration: number;
}): ReceiptOutcome => {
  const appended = input.args.appendReviewSection({
    projectDir: input.args.projectDir,
    stage: input.args.gate,
    section: reviewSectionFor({
      verdict: input.args.aggregate,
      reviewer: input.reviewer,
      iteration: input.iteration,
    }),
  });
  if (!appended.ok) {
    return {
      kind: "refused",
      step: "completed",
      reason: "other",
      detail: appended.detail,
    };
  }

  const completed = input.args.invokeEngine({
    projectDir: input.args.projectDir,
    stage: input.args.gate,
    reviewer: input.reviewer,
    iteration: input.iteration,
    verdict: input.args.aggregate,
  });
  return completed.ok
    ? {
        kind: "recorded",
        reviewer: input.reviewer,
        iteration: input.iteration,
      }
    : {
        kind: "refused",
        step: "completed",
        reason: refusalReasonIn(completed.output),
        detail: completed.output,
      };
};

// Derivation-free with respect to the reviewer: the caller reads the declared
// identity from the compiled stage graph and passes it. A gate→reviewer table
// here would be the drift the totality check exists to catch.
export const recordEngineReceipt = (args: {
  readonly projectDir: string;
  readonly gate: string;
  readonly declaredReviewer: string | null;
  readonly aggregate: BoardVerdictToken;
  readonly route?: EngineReviewRoute;
  readonly invokeEngine: EngineInvocation;
  readonly appendReviewSection: ReviewSectionAppend;
}): ReceiptOutcome => {
  if (args.declaredReviewer === null) return { kind: "no-declared-reviewer" };
  const reviewer = args.declaredReviewer;
  if ((args.route ?? "conductor-report") === "conductor-report") {
    return { kind: "conductor-report", reviewer, verdict: args.aggregate };
  }

  const request = (iteration: number) => {
    const result = args.invokeEngine({
      projectDir: args.projectDir,
      stage: args.gate,
      reviewer,
      iteration,
      verdict: null,
    });
    if (!result.ok || supportedLegacyRequest({ output: result.output, stage: args.gate })) return result;
    return {
      ok: false,
      output: "Legacy append requires a successful legacy REVIEW_REQUESTED response without a modern reviewFile or recordVerdict. Use the conductor report route.",
    };
  };

  const firstAttempt = request(FIRST_ITERATION);
  const iteration = firstAttempt.ok
    ? FIRST_ITERATION
    : expectedOrdinalIn({
        output: firstAttempt.output,
        stage: args.gate,
        requestedIteration: FIRST_ITERATION,
      });
  if (iteration === null) {
    return {
      kind: "refused",
      step: "requested",
      reason: refusalReasonIn(firstAttempt.output),
      detail: firstAttempt.output,
    };
  }
  const requested = firstAttempt.ok ? firstAttempt : request(iteration);
  if (!requested.ok) {
    return {
      kind: "refused",
      step: "requested",
      reason: refusalReasonIn(requested.output),
      detail: requested.output,
    };
  }
  return completeReceipt({ args, reviewer, iteration });
};

// The production seam: the engine CLI itself, so its validation applies to every
// receipt this bridge produces.
export const spawnEngineReview =
  (options: {
    readonly enginePath: string;
    readonly engineEnv?: NodeJS.ProcessEnv;
  }): EngineInvocation =>
  (args) => {
    const verdictFlags =
      args.verdict === null ? [] : ["--verdict", args.verdict];
    const result = spawnSync(
      "bun",
      [
        options.enginePath,
        "review",
        "--project-dir",
        args.projectDir,
        "--stage",
        args.stage,
        "--reviewer",
        args.reviewer,
        "--iteration",
        String(args.iteration),
        ...verdictFlags,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: options.engineEnv ?? process.env,
      },
    );
    return {
      ok: result.status === 0,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
    };
  };

// The production append seam. The target is the stage's declared
// `review_artifact` under the record dir at the phase/stage-scoped logical path
// the engine resolves a produces entry to — the caller supplies the resolved
// file, so this seam neither re-derives the engine's path rules nor guesses.
//
// Appended, never rewritten: the request baselined everything already in the
// file, so a rewrite would destroy the very bytes the completion re-checks. A
// leading newline is emitted only when the file does not already end with one,
// which keeps the appended bytes starting at a blank line or the heading itself
// — the shape validateReviewAppendix accepts.
export const appendReviewSectionToFile =
  (options: {
    readonly resolveArtifactPath: (args: {
      readonly projectDir: string;
      readonly stage: string;
    }) => string | null;
  }): ReviewSectionAppend =>
  (args) => {
    const path = options.resolveArtifactPath({
      projectDir: args.projectDir,
      stage: args.stage,
    });
    if (path === null) {
      return {
        ok: false,
        detail: `cannot resolve the review_artifact path for stage "${args.stage}" — the engine's REVIEW_COMPLETED needs the reviewer's \`## Review\` section appended to it.`,
      };
    }
    try {
      const existing = readFileSync(path, "utf8");
      const separator = existing.endsWith("\n") ? "" : "\n";
      appendFileSync(path, `${separator}\n${args.section}`);
      return { ok: true, detail: path };
    } catch (cause) {
      return {
        ok: false,
        detail: `could not append the \`## Review\` section to ${path}: ${String(cause)}`,
      };
    }
  };
