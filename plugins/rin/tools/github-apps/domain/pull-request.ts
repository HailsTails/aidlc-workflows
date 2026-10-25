import { fail, succeed, type Result } from "./result.ts";

type PullRequestLifecycle = "open" | "closed" | "merged";

type PullRequestReadiness = "draft" | "ready-for-review";

type PullRequestMergeability = "clean" | "not-clean";

type PullRequestSnapshot = {
  readonly pullNumber: number;
  readonly nodeId: string;
  readonly headSha: string;
  readonly lifecycle: PullRequestLifecycle;
  readonly readiness: PullRequestReadiness;
  readonly mergeability: PullRequestMergeability;
};

type ReviewStance = "approved" | "changes-requested" | "commented" | "dismissed" | "pending";

type ReviewRecord = { readonly stance: ReviewStance; readonly reviewedSha: string | null };

type ReviewEvent = "approve" | "request-changes" | "comment";

type PullRequestNotOpen = {
  readonly kind: "pull-request-not-open";
  readonly pullNumber: number;
  readonly lifecycle: Exclude<PullRequestLifecycle, "open">;
};

type OpenPullRequest = PullRequestSnapshot & { readonly lifecycle: "open" };

const requireOpenPullRequest = (
  pullRequest: PullRequestSnapshot,
): Result<OpenPullRequest, PullRequestNotOpen> => {
  if (pullRequest.lifecycle !== "open") {
    return fail({
      kind: "pull-request-not-open",
      pullNumber: pullRequest.pullNumber,
      lifecycle: pullRequest.lifecycle,
    });
  }
  return succeed({ ...pullRequest, lifecycle: pullRequest.lifecycle });
};

export {
  requireOpenPullRequest,
  type OpenPullRequest,
  type PullRequestLifecycle,
  type PullRequestMergeability,
  type PullRequestNotOpen,
  type PullRequestReadiness,
  type PullRequestSnapshot,
  type ReviewEvent,
  type ReviewRecord,
  type ReviewStance,
};
