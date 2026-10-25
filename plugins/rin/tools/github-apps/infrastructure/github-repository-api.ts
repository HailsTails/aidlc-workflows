import { z } from "zod";
import type { GitHubFailure } from "../application/github-failure.ts";
import type {
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
} from "../application/github-repository-port.ts";
import type {
  PullRequestReadiness,
  PullRequestSnapshot,
  ReviewRecord,
} from "../domain/pull-request.ts";
import { formatRepositorySlug, type RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { executeGraphql, type GraphqlConnection } from "./github-graphql.ts";
import {
  graphqlReviewEventOf,
  pullRequestNodeSchema,
  pullRequestSnapshotOf,
  reviewNodeSchema,
  reviewRecordOf,
} from "./github-pull-request-wire.ts";

const GITHUB_NOT_FOUND_STATUS = 404;

const REVIEW_WINDOW = 100;

type RepositoryConnection = GraphqlConnection & { readonly repository: RepositorySlug };

type RepositoryScope = { readonly connection: RepositoryConnection };

type Located<Request> = RepositoryScope & Request;

const linkSchema = z.object({ url: z.string() });

const missingNumber = ({
  connection,
  pullNumber,
}: Located<PullRequestReference>): GitHubFailure => ({
  kind: "github-rejected",
  operation: "find pull request",
  status: GITHUB_NOT_FOUND_STATUS,
  detail: `#${String(pullNumber)} does not exist in ${formatRepositorySlug(connection.repository)}`,
});

const readPullRequest = async ({
  connection,
  pullNumber,
}: Located<PullRequestReference>): Promise<Result<PullRequestSnapshot, GitHubFailure>> => {
  const found = await executeGraphql({
    ...connection,
    operation: "read pull request",
    query: `query ReadPullRequest($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) { id number headRefOid state isDraft mergeStateStatus }
      }
    }`,
    variables: { ...connection.repository, number: pullNumber },
    dataSchema: z.object({
      repository: z.object({ pullRequest: pullRequestNodeSchema.nullable() }).nullable(),
    }),
  });
  if (found.kind === "failure") return found;
  const node = found.outcome.repository?.pullRequest;
  if (node === undefined || node === null) return fail(missingNumber({ connection, pullNumber }));
  return succeed(pullRequestSnapshotOf(node));
};

const listReviews = async ({
  connection,
  pullNumber,
}: Located<PullRequestReference>): Promise<Result<readonly ReviewRecord[], GitHubFailure>> => {
  const found = await executeGraphql({
    ...connection,
    operation: "list reviews",
    query: `query ListReviews($owner: String!, $name: String!, $number: Int!, $window: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) { reviews(last: $window) { nodes { state commit { oid } } } }
      }
    }`,
    variables: { ...connection.repository, number: pullNumber, window: REVIEW_WINDOW },
    dataSchema: z.object({
      repository: z
        .object({
          pullRequest: z
            .object({ reviews: z.object({ nodes: z.array(reviewNodeSchema) }) })
            .nullable(),
        })
        .nullable(),
    }),
  });
  if (found.kind === "failure") return found;
  const reviews = found.outcome.repository?.pullRequest?.reviews.nodes;
  if (reviews === undefined) return fail(missingNumber({ connection, pullNumber }));
  return succeed(reviews.map(reviewRecordOf));
};

const readRepositoryId = async ({
  connection,
}: RepositoryScope): Promise<Result<string, GitHubFailure>> => {
  const found = await executeGraphql({
    ...connection,
    operation: "read repository",
    query: `query RepositoryId($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) { id }
    }`,
    variables: { ...connection.repository },
    dataSchema: z.object({ repository: z.object({ id: z.string() }) }),
  });
  if (found.kind === "failure") return found;
  return succeed(found.outcome.repository.id);
};

const openPullRequest = async ({
  connection,
  ...proposal
}: Located<PullRequestProposal>): Promise<Result<PublishedLink, GitHubFailure>> => {
  const repositoryId = await readRepositoryId({ connection });
  if (repositoryId.kind === "failure") return repositoryId;
  const opened = await executeGraphql({
    ...connection,
    operation: "open pull request",
    query: `mutation OpenPullRequest($repositoryId: ID!, $base: String!, $head: String!, $title: String!, $body: String!, $draft: Boolean!) {
      createPullRequest(input: { repositoryId: $repositoryId, baseRefName: $base, headRefName: $head, title: $title, body: $body, draft: $draft }) { pullRequest { url } }
    }`,
    variables: {
      repositoryId: repositoryId.outcome,
      base: proposal.base,
      head: proposal.head,
      title: proposal.title,
      body: proposal.body,
      draft: proposal.readiness === "draft",
    },
    dataSchema: z.object({ createPullRequest: z.object({ pullRequest: linkSchema }) }),
  });
  if (opened.kind === "failure") return opened;
  return succeed(opened.outcome.createPullRequest.pullRequest);
};

const revisePullRequest = async ({
  connection,
  ...revision
}: Located<PullRequestRevision>): Promise<Result<PublishedLink, GitHubFailure>> => {
  const revised = await executeGraphql({
    ...connection,
    operation: "revise pull request",
    query: `mutation RevisePullRequest($pullRequestId: ID!, $title: String, $body: String) {
      updatePullRequest(input: { pullRequestId: $pullRequestId, title: $title, body: $body }) { pullRequest { url } }
    }`,
    variables: { ...revision },
    dataSchema: z.object({ updatePullRequest: z.object({ pullRequest: linkSchema }) }),
  });
  if (revised.kind === "failure") return revised;
  return succeed(revised.outcome.updatePullRequest.pullRequest);
};

const submitReview = async ({
  connection,
  pullRequestId,
  event,
  commitSha,
  body: reviewBody,
}: Located<ReviewSubmission>): Promise<Result<PublishedLink, GitHubFailure>> => {
  const submitted = await executeGraphql({
    ...connection,
    operation: "submit review",
    query: `mutation SubmitReview($pullRequestId: ID!, $event: PullRequestReviewEvent!, $commitSha: GitObjectID!, $body: String!) {
      addPullRequestReview(input: { pullRequestId: $pullRequestId, event: $event, commitOID: $commitSha, body: $body }) { pullRequestReview { url } }
    }`,
    variables: {
      pullRequestId,
      event: graphqlReviewEventOf(event),
      commitSha,
      body: reviewBody,
    },
    dataSchema: z.object({ addPullRequestReview: z.object({ pullRequestReview: linkSchema }) }),
  });
  if (submitted.kind === "failure") return submitted;
  return succeed(submitted.outcome.addPullRequestReview.pullRequestReview);
};

const readCommentSubjectId = async ({
  connection,
  issueNumber,
}: Located<Pick<IssueComment, "issueNumber">>): Promise<Result<string, GitHubFailure>> => {
  const found = await executeGraphql({
    ...connection,
    operation: "find issue or pull request",
    query: `query CommentSubject($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issueOrPullRequest(number: $number) { ... on Issue { id } ... on PullRequest { id } }
      }
    }`,
    variables: { ...connection.repository, number: issueNumber },
    dataSchema: z.object({
      repository: z.object({ issueOrPullRequest: z.object({ id: z.string() }).nullable() }),
    }),
  });
  if (found.kind === "failure") return found;
  const subject = found.outcome.repository.issueOrPullRequest;
  if (subject === null) return fail(missingNumber({ connection, pullNumber: issueNumber }));
  return succeed(subject.id);
};

const commentOnIssue = async ({
  connection,
  issueNumber,
  body: commentBody,
}: Located<IssueComment>): Promise<Result<PublishedLink, GitHubFailure>> => {
  const subjectId = await readCommentSubjectId({ connection, issueNumber });
  if (subjectId.kind === "failure") return subjectId;
  const commented = await executeGraphql({
    ...connection,
    operation: "comment on issue",
    query: `mutation Comment($subjectId: ID!, $body: String!) {
      addComment(input: { subjectId: $subjectId, body: $body }) { commentEdge { node { url } } }
    }`,
    variables: { subjectId: subjectId.outcome, body: commentBody },
    dataSchema: z.object({
      addComment: z.object({ commentEdge: z.object({ node: linkSchema }) }),
    }),
  });
  if (commented.kind === "failure") return commented;
  return succeed(commented.outcome.addComment.commentEdge.node);
};

const squashMerge = async ({
  connection,
  pullRequestId,
  expectedHeadSha,
}: Located<SquashMerge>): Promise<Result<MergedCommit, GitHubFailure>> => {
  const merged = await executeGraphql({
    ...connection,
    operation: "squash merge",
    query: `mutation SquashMerge($pullRequestId: ID!, $expectedHeadSha: GitObjectID!) {
      mergePullRequest(input: { pullRequestId: $pullRequestId, mergeMethod: SQUASH, expectedHeadOid: $expectedHeadSha }) { pullRequest { mergeCommit { oid } } }
    }`,
    variables: { pullRequestId, expectedHeadSha },
    dataSchema: z.object({
      mergePullRequest: z.object({
        pullRequest: z.object({ mergeCommit: z.object({ oid: z.string() }) }),
      }),
    }),
  });
  if (merged.kind === "failure") return merged;
  return succeed({ mergeSha: merged.outcome.mergePullRequest.pullRequest.mergeCommit.oid });
};

const closePullRequest = async ({
  connection,
  pullRequestId,
}: Located<PullRequestIdentity>): Promise<Result<PublishedLink, GitHubFailure>> => {
  const closed = await executeGraphql({
    ...connection,
    operation: "close pull request",
    query: `mutation ClosePullRequest($pullRequestId: ID!) {
      closePullRequest(input: { pullRequestId: $pullRequestId }) { pullRequest { url } }
    }`,
    variables: { pullRequestId },
    dataSchema: z.object({ closePullRequest: z.object({ pullRequest: linkSchema }) }),
  });
  if (closed.kind === "failure") return closed;
  return succeed(closed.outcome.closePullRequest.pullRequest);
};

const readinessMutation = (readiness: PullRequestReadiness): string =>
  readiness === "draft" ? "convertPullRequestToDraft" : "markPullRequestReadyForReview";

const changeReadiness = async ({
  connection,
  pullRequestId,
  readiness,
}: Located<ReadinessChange>): Promise<Result<PullRequestReadiness, GitHubFailure>> => {
  const changed = await executeGraphql({
    ...connection,
    operation: "change readiness",
    query: `mutation ChangeReadiness($pullRequestId: ID!) {
      readinessChange: ${readinessMutation(readiness)}(input: { pullRequestId: $pullRequestId }) { pullRequest { isDraft } }
    }`,
    variables: { pullRequestId },
    dataSchema: z.object({
      readinessChange: z.object({ pullRequest: z.object({ isDraft: z.boolean() }) }),
    }),
  });
  if (changed.kind === "failure") return changed;
  return succeed(
    changed.outcome.readinessChange.pullRequest.isDraft ? "draft" : "ready-for-review",
  );
};

const createGitHubRepositoryApi = (connection: RepositoryConnection): GitHubRepositoryPort => ({
  openPullRequest: (proposal) => openPullRequest({ connection, ...proposal }),
  revisePullRequest: (revision) => revisePullRequest({ connection, ...revision }),
  readPullRequest: (reference) => readPullRequest({ connection, ...reference }),
  listReviews: (reference) => listReviews({ connection, ...reference }),
  submitReview: (submission) => submitReview({ connection, ...submission }),
  commentOnIssue: (comment) => commentOnIssue({ connection, ...comment }),
  squashMerge: (merge) => squashMerge({ connection, ...merge }),
  closePullRequest: (identity) => closePullRequest({ connection, ...identity }),
  changeReadiness: (change) => changeReadiness({ connection, ...change }),
});

export { createGitHubRepositoryApi, type RepositoryConnection };
