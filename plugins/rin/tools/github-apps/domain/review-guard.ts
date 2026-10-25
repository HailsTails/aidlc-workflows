import {
  requireOpenPullRequest,
  type PullRequestNotOpen,
  type PullRequestSnapshot,
} from "./pull-request.ts";
import { fail, succeed, type Result } from "./result.ts";

type ReviewRefusal =
  | PullRequestNotOpen
  | {
      readonly kind: "reviewed-head-moved";
      readonly pullNumber: number;
      readonly reviewedSha: string;
      readonly headSha: string;
    };

type ReviewTarget = {
  readonly pullRequest: PullRequestSnapshot;
  readonly reviewedSha: string | undefined;
};

type ReviewBinding = { readonly pullNumber: number; readonly commitSha: string };

const assessReviewTarget = ({
  pullRequest,
  reviewedSha,
}: ReviewTarget): Result<ReviewBinding, ReviewRefusal> => {
  const openPullRequest = requireOpenPullRequest(pullRequest);
  if (openPullRequest.kind === "failure") return openPullRequest;
  const { pullNumber, headSha } = openPullRequest.outcome;
  if (reviewedSha !== undefined && reviewedSha !== headSha) {
    return fail({ kind: "reviewed-head-moved", pullNumber, reviewedSha, headSha });
  }
  return succeed({ pullNumber, commitSha: headSha });
};

export { assessReviewTarget, type ReviewBinding, type ReviewRefusal };
