import { z } from "zod";

const SHORT_SHA_LENGTH = 7;

const REVIEW_EVENTS = {
  READY: "approve",
  "NOT-READY": "request-changes",
} as const;

type BoardVerdict = keyof typeof REVIEW_EVENTS;
type ReviewEvent = (typeof REVIEW_EVENTS)[BoardVerdict];

const BoardVerdictFileSchema = z.object({
  gate: z.string().min(1),
  taskId: z.string().min(1),
  verdict: z.enum(["READY", "NOT-READY"]),
  lenses: z.array(z.string()).default([]),
  blockingFindings: z.array(z.string()).default([]),
  headSha: z.string().min(1).optional(),
  binding: z
    .object({ mode: z.string().min(1), headSha: z.string().min(1).optional() })
    .optional(),
});

type BoardVerdictFile = z.infer<typeof BoardVerdictFileSchema>;

type StandingReview = {
  readonly state: string;
  readonly commitSha: string | null;
  readonly submittedAt: string;
};

type PullRequestState = {
  readonly state: string;
  readonly headRefOid: string;
};

type ReviewPostFailure =
  | { readonly kind: "review-post-unconfigured" }
  | { readonly kind: "review-post-unavailable" }
  | { readonly kind: "review-post-refused"; readonly processStatus: number }
  | {
      readonly kind: "review-post-interrupted";
      readonly terminationSignal: string;
    };

type ReviewPostResult =
  | { readonly outcome: "posted" }
  | {
      readonly outcome: "failed";
      readonly reviewPostFailure: ReviewPostFailure;
    };

type ReviewPostInvocation = {
  readonly pullRequestNumber: number;
  readonly event: ReviewEvent;
  readonly commitSha: string;
  readonly body: string;
};

type ReviewPost = (reviewInvocation: ReviewPostInvocation) => ReviewPostResult;

type BridgePorts = {
  readonly readVerdictFile: (input: { readonly path: string }) => string | null;
  readonly readPullRequest: (input: {
    readonly pullRequestNumber: number;
  }) => PullRequestState | null;
  readonly readReviews: (input: {
    readonly pullRequestNumber: number;
  }) => readonly StandingReview[];
  readonly postReview: ReviewPost;
};

type BridgeRefusal =
  | ReviewPostFailure
  | { readonly kind: "verdict-absent"; readonly path: string }
  | { readonly kind: "verdict-malformed"; readonly detail: string }
  | { readonly kind: "verdict-landed"; readonly mode: string }
  | { readonly kind: "verdict-headless" }
  | { readonly kind: "pull-request-unreadable"; readonly detail: string }
  | { readonly kind: "pull-request-closed"; readonly state: string }
  | {
      readonly kind: "head-moved";
      readonly reviewedHeadSha: string;
      readonly currentHeadSha: string;
    };

type BridgeOutcome =
  | {
      readonly disposition: "posted";
      readonly event: ReviewEvent;
      readonly commitSha: string;
    }
  | {
      readonly disposition: "already-reviewed";
      readonly standingState: string;
      readonly commitSha: string;
    };

type BridgeResult =
  | { readonly outcome: "ok"; readonly value: BridgeOutcome }
  | { readonly outcome: "refused"; readonly refusal: BridgeRefusal };

const refuse = (refusal: BridgeRefusal): BridgeResult => ({
  outcome: "refused",
  refusal,
});

const proceed = (value: BridgeOutcome): BridgeResult => ({
  outcome: "ok",
  value,
});

const reviewedHeadOf = (
  verdict: BoardVerdictFile,
): { readonly headSha: string } | { readonly refusal: BridgeRefusal } => {
  const { binding } = verdict;
  if (binding !== undefined && binding.mode !== "live")
    return { refusal: { kind: "verdict-landed", mode: binding.mode } };
  const headSha = binding?.headSha ?? verdict.headSha;
  return headSha === undefined
    ? { refusal: { kind: "verdict-headless" } }
    : { headSha };
};

const parseVerdictFile = (
  raw: string,
): { readonly parsed: BoardVerdictFile } | { readonly detail: string } => {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { detail: "not valid JSON" };
  }
  const decoded = BoardVerdictFileSchema.safeParse(candidate);
  return decoded.success
    ? { parsed: decoded.data }
    : { detail: decoded.error.issues.map((issue) => issue.message).join("; ") };
};

const standingReviewAt = (input: {
  readonly reviews: readonly StandingReview[];
  readonly headSha: string;
}): StandingReview | null => {
  const atHead = input.reviews.filter(
    (review) =>
      review.commitSha === input.headSha &&
      (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED"),
  );
  return atHead.length === 0
    ? null
    : atHead.reduce((latest, review) =>
        review.submittedAt > latest.submittedAt ? review : latest,
      );
};

const reviewBodyOf = (input: {
  readonly verdict: BoardVerdictFile;
}): string => {
  const { gate, taskId, verdict, lenses, blockingFindings } = input.verdict;
  const roster =
    lenses.length === 0
      ? "_none recorded_"
      : lenses.map((lens) => `- ${lens}`).join("\n");
  const findings =
    blockingFindings.length === 0
      ? "None — no lens left a live cited finding."
      : blockingFindings.map((finding) => `- ${finding}`).join("\n");
  return [
    `## Decorrelated board verdict — ${verdict}`,
    "",
    `Posted from the board's \`review-verdict.json\` for \`${taskId}\` at gate \`${gate}\`, bound to the exact head the board reviewed.`,
    "",
    `### Lenses (${lenses.length})`,
    roster,
    "",
    "### Blocking findings",
    findings,
  ].join("\n");
};

const bridgeBoardVerdict = (input: {
  readonly verdictPath: string;
  readonly pullRequestNumber: number;
  readonly ports: BridgePorts;
}): BridgeResult => {
  const { verdictPath, pullRequestNumber, ports } = input;

  const raw = ports.readVerdictFile({ path: verdictPath });
  if (raw === null)
    return refuse({ kind: "verdict-absent", path: verdictPath });

  const decoded = parseVerdictFile(raw);
  if ("detail" in decoded)
    return refuse({ kind: "verdict-malformed", detail: decoded.detail });
  const verdict = decoded.parsed;

  const head = reviewedHeadOf(verdict);
  if ("refusal" in head) return refuse(head.refusal);
  const reviewedHeadSha = head.headSha;

  const pullRequest = ports.readPullRequest({ pullRequestNumber });
  if (pullRequest === null)
    return refuse({
      kind: "pull-request-unreadable",
      detail: `PR #${pullRequestNumber}`,
    });
  if (pullRequest.state !== "OPEN")
    return refuse({ kind: "pull-request-closed", state: pullRequest.state });

  if (pullRequest.headRefOid !== reviewedHeadSha)
    return refuse({
      kind: "head-moved",
      reviewedHeadSha,
      currentHeadSha: pullRequest.headRefOid,
    });

  const standing = standingReviewAt({
    reviews: ports.readReviews({ pullRequestNumber }),
    headSha: reviewedHeadSha,
  });
  if (standing !== null)
    return proceed({
      disposition: "already-reviewed",
      standingState: standing.state,
      commitSha: reviewedHeadSha,
    });

  const event = REVIEW_EVENTS[verdict.verdict];
  const postResult = ports.postReview({
    pullRequestNumber,
    event,
    commitSha: reviewedHeadSha,
    body: reviewBodyOf({ verdict }),
  });
  if (postResult.outcome === "failed")
    return refuse(postResult.reviewPostFailure);
  return proceed({ disposition: "posted", event, commitSha: reviewedHeadSha });
};

const refusalMessage = (refusal: BridgeRefusal): string => {
  switch (refusal.kind) {
    case "review-post-unconfigured":
      return "No review command is configured.";
    case "review-post-unavailable":
      return "The review command could not complete. Read back the standing review before retrying.";
    case "review-post-refused":
      return `The review command exited with status ${refusal.processStatus}. Read back the standing review before retrying.`;
    case "review-post-interrupted":
      return `The review command was interrupted by ${refusal.terminationSignal}. Read back the standing review before retrying.`;
    case "verdict-absent":
      return `No board verdict at ${refusal.path}. Converge the board first — the scribe writes this file when the lens roster is covered.`;
    case "verdict-malformed":
      return `The board verdict could not be read: ${refusal.detail}.`;
    case "verdict-landed":
      return `The board verdict has a '${refusal.mode}' binding, which describes merged content and carries no open head to post against. Review the live head instead.`;
    case "verdict-headless":
      return "The board verdict names no reviewed head — neither a top-level headSha nor binding.headSha. Re-emit it; a verdict that cannot say what it reviewed cannot be posted.";
    case "pull-request-unreadable":
      return `Could not read ${refusal.detail}.`;
    case "pull-request-closed":
      return `The pull request is ${refusal.state}; a review posted now would be lost. Capture the verdict as a follow-up finding instead.`;
    case "head-moved":
      return `The board reviewed ${refusal.reviewedHeadSha.slice(0, SHORT_SHA_LENGTH)} but the head is now ${refusal.currentHeadSha.slice(0, SHORT_SHA_LENGTH)}. Re-review the current head — posting would attribute this verdict to content no lens read.`;
  }
};

export type {
  BoardVerdictFile,
  BridgeOutcome,
  BridgePorts,
  BridgeRefusal,
  BridgeResult,
  PullRequestState,
  ReviewEvent,
  ReviewPost,
  ReviewPostFailure,
  ReviewPostInvocation,
  ReviewPostResult,
  StandingReview,
};
export {
  BoardVerdictFileSchema,
  bridgeBoardVerdict,
  REVIEW_EVENTS,
  refusalMessage,
  reviewBodyOf,
  SHORT_SHA_LENGTH,
  standingReviewAt,
};
