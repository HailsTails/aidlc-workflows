import {
  requireOpenPullRequest,
  type PullRequestNotOpen,
  type PullRequestSnapshot,
  type ReviewRecord,
} from "./pull-request.ts";
import { fail, succeed, type Result } from "./result.ts";
import { latestVerdict } from "./review-verdict.ts";

type MergeRefusal =
  | PullRequestNotOpen
  | { readonly kind: "pull-request-is-draft"; readonly pullNumber: number }
  | {
      readonly kind: "approval-missing";
      readonly pullNumber: number;
      readonly latestStance: "changes-requested" | "no-verdict";
    }
  | {
      readonly kind: "approval-on-stale-head";
      readonly pullNumber: number;
      readonly approvedSha: string | null;
      readonly headSha: string;
    };

type MergeCandidate = {
  readonly pullRequest: PullRequestSnapshot;
  readonly reviews: readonly ReviewRecord[];
};

type MergeClearance = { readonly pullNumber: number; readonly headSha: string };

const assessMerge = ({
  pullRequest,
  reviews,
}: MergeCandidate): Result<MergeClearance, MergeRefusal> => {
  const openPullRequest = requireOpenPullRequest(pullRequest);
  if (openPullRequest.kind === "failure") return openPullRequest;
  const { pullNumber, headSha, readiness } = openPullRequest.outcome;
  if (readiness === "draft") return fail({ kind: "pull-request-is-draft", pullNumber });
  const verdict = latestVerdict(reviews);
  if (verdict === undefined) {
    return fail({ kind: "approval-missing", pullNumber, latestStance: "no-verdict" });
  }
  if (verdict.stance === "changes-requested") {
    return fail({ kind: "approval-missing", pullNumber, latestStance: "changes-requested" });
  }
  if (verdict.reviewedSha !== headSha) {
    return fail({
      kind: "approval-on-stale-head",
      pullNumber,
      approvedSha: verdict.reviewedSha,
      headSha,
    });
  }
  return succeed({ pullNumber, headSha });
};

export { assessMerge, type MergeClearance, type MergeRefusal };
