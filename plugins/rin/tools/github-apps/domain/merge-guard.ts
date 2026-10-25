import {
  requireOpenPullRequest,
  type PullRequestMergeState,
  type PullRequestNotOpen,
  type PullRequestSnapshot,
} from "./pull-request.ts";
import { fail, succeed, type Result } from "./result.ts";

type MergeRefusal =
  | PullRequestNotOpen
  | { readonly kind: "pull-request-is-draft"; readonly pullNumber: number }
  | {
      readonly kind: "pull-request-not-mergeable";
      readonly pullNumber: number;
      readonly mergeState: Exclude<PullRequestMergeState, "clean">;
    };

type MergeClearance = { readonly pullNumber: number; readonly headSha: string };

const assessMerge = (
  pullRequest: PullRequestSnapshot,
): Result<MergeClearance, MergeRefusal> => {
  const openPullRequest = requireOpenPullRequest(pullRequest);
  if (openPullRequest.kind === "failure") return openPullRequest;
  const { pullNumber, headSha, readiness, mergeState } = openPullRequest.outcome;
  if (readiness === "draft") return fail({ kind: "pull-request-is-draft", pullNumber });
  if (mergeState !== "clean") {
    return fail({ kind: "pull-request-not-mergeable", pullNumber, mergeState });
  }
  return succeed({ pullNumber, headSha });
};

export { assessMerge, type MergeClearance, type MergeRefusal };
