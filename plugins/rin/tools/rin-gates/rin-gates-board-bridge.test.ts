import { describe, expect, test } from "vitest";
import {
  type BridgePorts,
  bridgeBoardVerdict,
  type PullRequestState,
  type ReviewPostFailure,
  refusalMessage,
  reviewBodyOf,
  type StandingReview,
  standingReviewAt,
} from "./rin-gates-board-bridge.ts";

const REVIEWED_HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const MOVED_HEAD = "9876543210fedcba9876543210fedcba98765432";

const readyVerdictJson = JSON.stringify({
  gate: "rin-gate-5-review-cycle",
  taskId: "260904-board-github-bridge",
  verdict: "READY",
  lenses: ["rin-pr-scope-reviewer-agent", "rin-pr-claims-reviewer-agent"],
  blockingFindings: [],
  binding: { mode: "live", headSha: REVIEWED_HEAD },
});

const notReadyVerdictJson = JSON.stringify({
  gate: "rin-gate-5-review-cycle",
  taskId: "260904-board-github-bridge",
  verdict: "NOT-READY",
  lenses: ["rin-pr-evades-reviewer-agent"],
  blockingFindings: ["CD-9: repository port bypassed at foo.ts:12"],
  binding: { mode: "live", headSha: REVIEWED_HEAD },
});

// The SubagentStop scribe's real shape: a TOP-LEVEL headSha and no `binding`
// key. Field-for-field from rin-gates-review-scribe.ts, which writes 41 of the
// 344 committed verdicts and 221 of them carry no binding at all.
const scribeWrittenVerdictJson = JSON.stringify({
  gate: "rin-gate-5-review-cycle",
  taskId: "260904-board-github-bridge",
  headSha: REVIEWED_HEAD,
  verdict: "READY",
  lenses: ["rin-pr-scope-reviewer-agent"],
  findings: [],
  blockingFindings: [],
  emittedBy: "rin-gates-review-scribe",
  reviewedAt: "2026-09-04T22:00:00.000Z",
});

const openPullRequest: PullRequestState = {
  state: "OPEN",
  headRefOid: REVIEWED_HEAD,
};

type PostedReview = {
  readonly pullRequestNumber: number;
  readonly event: string;
  readonly commitSha: string;
  readonly body: string;
};

const portsWith = (overrides: {
  readonly verdictJson?: string | null;
  readonly pullRequest?: PullRequestState | null;
  readonly reviews?: readonly StandingReview[];
  readonly posted?: PostedReview[];
}): BridgePorts => ({
  readVerdictFile: () =>
    overrides.verdictJson === undefined
      ? readyVerdictJson
      : overrides.verdictJson,
  readPullRequest: () =>
    overrides.pullRequest === undefined
      ? openPullRequest
      : overrides.pullRequest,
  readReviews: () => overrides.reviews ?? [],
  postReview: (input) => {
    overrides.posted?.push(input);
    return { outcome: "posted" };
  },
});

describe("bridgeBoardVerdict", () => {
  test.each<ReviewPostFailure>([
    { kind: "review-post-unconfigured" },
    { kind: "review-post-unavailable" },
    { kind: "review-post-refused", processStatus: 7 },
    { kind: "review-post-interrupted", terminationSignal: "SIGTERM" },
  ])("refuses when posting returns $kind", (reviewPostFailure) => {
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: {
        ...portsWith({}),
        postReview: () => ({ outcome: "failed", reviewPostFailure }),
      },
    });

    expect(result).toEqual({ outcome: "refused", refusal: reviewPostFailure });
  });

  test("posts an approve bound to the reviewed head when the board is READY", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ posted }),
    });

    expect(result).toEqual({
      outcome: "ok",
      value: {
        disposition: "posted",
        event: "approve",
        commitSha: REVIEWED_HEAD,
      },
    });
    expect(posted).toHaveLength(1);
    expect(posted[0]?.event).toBe("approve");
    expect(posted[0]?.commitSha).toBe(REVIEWED_HEAD);
    expect(posted[0]?.pullRequestNumber).toBe(757);
  });

  test("posts request-changes when the board is NOT-READY", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ verdictJson: notReadyVerdictJson, posted }),
    });

    expect(result).toEqual({
      outcome: "ok",
      value: {
        disposition: "posted",
        event: "request-changes",
        commitSha: REVIEWED_HEAD,
      },
    });
    expect(posted[0]?.event).toBe("request-changes");
  });

  test("refuses and posts nothing when the head moved after the board reviewed", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({
        pullRequest: { state: "OPEN", headRefOid: MOVED_HEAD },
        posted,
      }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: {
        kind: "head-moved",
        reviewedHeadSha: REVIEWED_HEAD,
        currentHeadSha: MOVED_HEAD,
      },
    });
    expect(posted).toHaveLength(0);
  });

  test("inherits a standing review at the reviewed head instead of stacking a duplicate", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({
        reviews: [
          {
            state: "APPROVED",
            commitSha: REVIEWED_HEAD,
            submittedAt: "2026-09-04T22:00:00Z",
          },
        ],
        posted,
      }),
    });

    expect(result).toEqual({
      outcome: "ok",
      value: {
        disposition: "already-reviewed",
        standingState: "APPROVED",
        commitSha: REVIEWED_HEAD,
      },
    });
    expect(posted).toHaveLength(0);
  });

  test("posts when the only standing review predates the reviewed head", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({
        reviews: [
          {
            state: "APPROVED",
            commitSha: MOVED_HEAD,
            submittedAt: "2026-09-04T20:00:00Z",
          },
        ],
        posted,
      }),
    });

    expect(result).toEqual({
      outcome: "ok",
      value: {
        disposition: "posted",
        event: "approve",
        commitSha: REVIEWED_HEAD,
      },
    });
    expect(posted).toHaveLength(1);
  });

  test("refuses when no board verdict has been written", () => {
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ verdictJson: null }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: {
        kind: "verdict-absent",
        path: "/records/gate/review-verdict.json",
      },
    });
  });

  test("posts a SCRIBE-written verdict, whose head is top-level with no binding key", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ verdictJson: scribeWrittenVerdictJson, posted }),
    });

    expect(result).toEqual({
      outcome: "ok",
      value: {
        disposition: "posted",
        event: "approve",
        commitSha: REVIEWED_HEAD,
      },
    });
    expect(posted[0]?.commitSha).toBe(REVIEWED_HEAD);
  });

  test("refuses a SCRIBE-written verdict whose top-level head moved", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({
        verdictJson: scribeWrittenVerdictJson,
        pullRequest: { state: "OPEN", headRefOid: MOVED_HEAD },
        posted,
      }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: {
        kind: "head-moved",
        reviewedHeadSha: REVIEWED_HEAD,
        currentHeadSha: MOVED_HEAD,
      },
    });
    expect(posted).toHaveLength(0);
  });

  test("refuses a landed verdict by its own kind, not as malformed", () => {
    const landed = JSON.stringify({
      gate: "rin-gate-5-review-cycle",
      taskId: "260904-board-github-bridge",
      verdict: "READY",
      lenses: [],
      blockingFindings: [],
      binding: { mode: "landed", pullRequestNumber: 700 },
    });
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ verdictJson: landed }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: { kind: "verdict-landed", mode: "landed" },
    });
  });

  test("refuses a verdict that names no reviewed head in either position", () => {
    const headless = JSON.stringify({
      gate: "rin-gate-5-review-cycle",
      taskId: "260904-board-github-bridge",
      verdict: "READY",
      lenses: [],
      blockingFindings: [],
    });
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ verdictJson: headless }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: { kind: "verdict-headless" },
    });
  });

  test("refuses a closed pull request so a verdict is never posted into the void", () => {
    const posted: PostedReview[] = [];
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({
        pullRequest: { state: "MERGED", headRefOid: REVIEWED_HEAD },
        posted,
      }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: { kind: "pull-request-closed", state: "MERGED" },
    });
    expect(posted).toHaveLength(0);
  });

  test("refuses an unreadable pull request", () => {
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ pullRequest: null }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: { kind: "pull-request-unreadable", detail: "PR #757" },
    });
  });

  test("refuses malformed verdict JSON", () => {
    const result = bridgeBoardVerdict({
      verdictPath: "/records/gate/review-verdict.json",
      pullRequestNumber: 757,
      ports: portsWith({ verdictJson: "{ not json" }),
    });

    expect(result).toEqual({
      outcome: "refused",
      refusal: { kind: "verdict-malformed", detail: "not valid JSON" },
    });
  });
});

describe("standingReviewAt", () => {
  test("takes the latest verdict at the head when several stand", () => {
    const result = standingReviewAt({
      reviews: [
        {
          state: "CHANGES_REQUESTED",
          commitSha: REVIEWED_HEAD,
          submittedAt: "2026-09-04T20:00:00Z",
        },
        {
          state: "APPROVED",
          commitSha: REVIEWED_HEAD,
          submittedAt: "2026-09-04T22:00:00Z",
        },
      ],
      headSha: REVIEWED_HEAD,
    });

    expect(result?.state).toBe("APPROVED");
  });

  test("ignores a commented review that carries no verdict", () => {
    const result = standingReviewAt({
      reviews: [
        {
          state: "COMMENTED",
          commitSha: REVIEWED_HEAD,
          submittedAt: "2026-09-04T22:00:00Z",
        },
      ],
      headSha: REVIEWED_HEAD,
    });

    expect(result).toBeNull();
  });

  test("ignores a review with no recorded commit", () => {
    const result = standingReviewAt({
      reviews: [
        {
          state: "APPROVED",
          commitSha: null,
          submittedAt: "2026-09-04T22:00:00Z",
        },
      ],
      headSha: REVIEWED_HEAD,
    });

    expect(result).toBeNull();
  });
});

describe("reviewBodyOf", () => {
  test("names the verdict, the record, the gate and every lens", () => {
    const body = reviewBodyOf({
      verdict: {
        gate: "rin-gate-5-review-cycle",
        taskId: "260904-board-github-bridge",
        verdict: "READY",
        lenses: ["rin-pr-scope-reviewer-agent"],
        blockingFindings: [],
        binding: { mode: "live", headSha: REVIEWED_HEAD },
      },
    });

    expect(body).toContain("READY");
    expect(body).toContain("260904-board-github-bridge");
    expect(body).toContain("rin-gate-5-review-cycle");
    expect(body).toContain("rin-pr-scope-reviewer-agent");
    expect(body).toContain("None — no lens left a live cited finding.");
  });

  test("lists each blocking finding when the board refused", () => {
    const body = reviewBodyOf({
      verdict: {
        gate: "rin-gate-5-review-cycle",
        taskId: "260904-board-github-bridge",
        verdict: "NOT-READY",
        lenses: ["rin-pr-evades-reviewer-agent"],
        blockingFindings: ["CD-9: repository port bypassed at foo.ts:12"],
        binding: { mode: "live", headSha: REVIEWED_HEAD },
      },
    });

    expect(body).toContain("CD-9: repository port bypassed at foo.ts:12");
  });
});

describe("refusalMessage", () => {
  test("names both shas so the reader can see which content was reviewed", () => {
    const message = refusalMessage({
      kind: "head-moved",
      reviewedHeadSha: REVIEWED_HEAD,
      currentHeadSha: MOVED_HEAD,
    });

    expect(message).toContain(REVIEWED_HEAD.slice(0, 7));
    expect(message).toContain(MOVED_HEAD.slice(0, 7));
  });

  test("tells the reader to converge the board when no verdict exists", () => {
    const message = refusalMessage({
      kind: "verdict-absent",
      path: "/records/gate/review-verdict.json",
    });

    expect(message).toContain("/records/gate/review-verdict.json");
  });

  test("explains that a closed pull request would swallow the verdict", () => {
    const message = refusalMessage({
      kind: "pull-request-closed",
      state: "MERGED",
    });

    expect(message).toContain("MERGED");
  });

  test("reports the parse detail on a malformed verdict", () => {
    const message = refusalMessage({
      kind: "verdict-malformed",
      detail: "not valid JSON",
    });

    expect(message).toContain("not valid JSON");
  });

  test("names the binding mode on a landed verdict", () => {
    const message = refusalMessage({ kind: "verdict-landed", mode: "landed" });

    expect(message).toContain("landed");
  });

  test("names both head positions when a verdict carries neither", () => {
    const message = refusalMessage({ kind: "verdict-headless" });

    expect(message).toContain("headSha");
    expect(message).toContain("binding.headSha");
  });

  test("names the pull request it could not read", () => {
    const message = refusalMessage({
      kind: "pull-request-unreadable",
      detail: "PR #757",
    });

    expect(message).toContain("PR #757");
  });
});
