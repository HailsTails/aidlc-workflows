import type {
  PullRequestReadiness,
  PullRequestSnapshot,
  ReviewEvent,
  ReviewRecord,
} from "../domain/pull-request.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";

type PullRequestProposal = {
  readonly title: string;
  readonly body: string;
  readonly head: string;
  readonly base: string;
  readonly readiness: PullRequestReadiness;
};

type PullRequestRevision = {
  readonly pullRequestId: string;
  readonly title: string | undefined;
  readonly body: string | undefined;
};

type ReviewSubmission = {
  readonly pullRequestId: string;
  readonly event: ReviewEvent;
  readonly commitSha: string;
  readonly body: string;
};

type IssueComment = { readonly issueNumber: number; readonly body: string };

type SquashMerge = { readonly pullRequestId: string; readonly expectedHeadSha: string };

type ReadinessChange = { readonly pullRequestId: string; readonly readiness: PullRequestReadiness };

type PullRequestReference = { readonly pullNumber: number };

type PullRequestIdentity = { readonly pullRequestId: string };

type PublishedLink = { readonly url: string };

type MergedCommit = { readonly mergeSha: string };

type GitHubRepositoryPort = {
  readonly openPullRequest: (
    proposal: PullRequestProposal,
  ) => Promise<Result<PublishedLink, GitHubFailure>>;
  readonly revisePullRequest: (
    revision: PullRequestRevision,
  ) => Promise<Result<PublishedLink, GitHubFailure>>;
  readonly readPullRequest: (
    reference: PullRequestReference,
  ) => Promise<Result<PullRequestSnapshot, GitHubFailure>>;
  readonly listReviews: (
    reference: PullRequestReference,
  ) => Promise<Result<readonly ReviewRecord[], GitHubFailure>>;
  readonly submitReview: (
    submission: ReviewSubmission,
  ) => Promise<Result<PublishedLink, GitHubFailure>>;
  readonly commentOnIssue: (comment: IssueComment) => Promise<Result<PublishedLink, GitHubFailure>>;
  readonly squashMerge: (merge: SquashMerge) => Promise<Result<MergedCommit, GitHubFailure>>;
  readonly closePullRequest: (
    identity: PullRequestIdentity,
  ) => Promise<Result<PublishedLink, GitHubFailure>>;
  readonly changeReadiness: (
    change: ReadinessChange,
  ) => Promise<Result<PullRequestReadiness, GitHubFailure>>;
};

export type {
  GitHubRepositoryPort,
  IssueComment,
  MergedCommit,
  PublishedLink,
  PullRequestIdentity,
  PullRequestProposal,
  PullRequestReference,
  PullRequestRevision,
  ReadinessChange,
  ReviewSubmission,
  SquashMerge,
};
