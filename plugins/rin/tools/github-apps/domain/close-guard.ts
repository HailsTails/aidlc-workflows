import {
  requireOpenPullRequest,
  type PullRequestNotOpen,
  type PullRequestSnapshot,
  type ReviewRecord,
} from "./pull-request.ts";
import { fail, succeed, type Result } from "./result.ts";
import { latestVerdict } from "./review-verdict.ts";

type CloseRefusal =
  PullRequestNotOpen | { readonly kind: "approved-and-mergeable"; readonly pullNumber: number };

type CloseCandidate = {
  readonly pullRequest: PullRequestSnapshot;
  readonly reviews: readonly ReviewRecord[];
};

type CloseClearance = { readonly pullNumber: number };

const assessClose = ({
  pullRequest,
  reviews,
}: CloseCandidate): Result<CloseClearance, CloseRefusal> => {
  const openPullRequest = requireOpenPullRequest(pullRequest);
  if (openPullRequest.kind === "failure") return openPullRequest;
  const { pullNumber, mergeability } = openPullRequest.outcome;
  if (latestVerdict(reviews)?.stance === "approved" && mergeability === "clean") {
    return fail({ kind: "approved-and-mergeable", pullNumber });
  }
  return succeed({ pullNumber });
};

export { assessClose, type CloseClearance, type CloseRefusal };
