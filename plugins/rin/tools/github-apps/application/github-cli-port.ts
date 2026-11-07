import type {
  PullRequestSnapshot,
  ReviewEvent,
  ReviewRecord,
} from "../domain/pull-request.ts";
import type { Result } from "../domain/result.ts";

type GhRun = {
  readonly standardOutput: string;
  readonly standardError: string;
  readonly exitCode: number;
};

type GhRequest = {
  readonly ghArguments: readonly string[];
  readonly standardInput: string | undefined;
};

type GhUnavailable = { readonly kind: "gh-unavailable"; readonly detail: string };

type GhReadFailed = {
  readonly kind: "gh-read-failed";
  readonly operation: string;
  readonly detail: string;
};

type PullRequestReview = {
  readonly pullRequest: PullRequestSnapshot;
  readonly reviews: readonly ReviewRecord[];
};

type ReviewPosting = {
  readonly pullRequestId: string;
  readonly commitSha: string;
  readonly event: ReviewEvent;
  readonly body: string;
};

type GitHubCliPort = {
  readonly run: (request: GhRequest) => Promise<Result<GhRun, GhUnavailable>>;
  readonly readPullRequest: (
    pullNumber: number,
  ) => Promise<Result<PullRequestReview, GhUnavailable | GhReadFailed>>;
  readonly submitReview: (posting: ReviewPosting) => Promise<Result<GhRun, GhUnavailable>>;
};

export type {
  GhReadFailed,
  GhRequest,
  GhRun,
  GhUnavailable,
  GitHubCliPort,
  PullRequestReview,
  ReviewPosting,
};
