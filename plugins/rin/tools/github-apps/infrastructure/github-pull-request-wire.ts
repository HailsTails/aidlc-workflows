import { z } from "zod";
import type {
  PullRequestLifecycle,
  PullRequestSnapshot,
  ReviewEvent,
  ReviewRecord,
  ReviewStance,
} from "../domain/pull-request.ts";

const pullRequestNodeSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  headRefOid: z.string(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  isDraft: z.boolean(),
  mergeStateStatus: z.string(),
});

const reviewNodeSchema = z.object({
  state: z.enum(["PENDING", "COMMENTED", "APPROVED", "CHANGES_REQUESTED", "DISMISSED"]),
  commit: z.object({ oid: z.string() }).nullable(),
});

type PullRequestNode = z.infer<typeof pullRequestNodeSchema>;

type ReviewNode = z.infer<typeof reviewNodeSchema>;

type GraphqlReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

const lifecycleOf = (state: PullRequestNode["state"]): PullRequestLifecycle => {
  switch (state) {
    case "OPEN":
      return "open";
    case "CLOSED":
      return "closed";
    case "MERGED":
      return "merged";
  }
};

const stanceOf = (state: ReviewNode["state"]): ReviewStance => {
  switch (state) {
    case "PENDING":
      return "pending";
    case "COMMENTED":
      return "commented";
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes-requested";
    case "DISMISSED":
      return "dismissed";
  }
};

const graphqlReviewEventOf = (event: ReviewEvent): GraphqlReviewEvent => {
  switch (event) {
    case "approve":
      return "APPROVE";
    case "request-changes":
      return "REQUEST_CHANGES";
    case "comment":
      return "COMMENT";
  }
};

const pullRequestSnapshotOf = (node: PullRequestNode): PullRequestSnapshot => ({
  pullNumber: node.number,
  nodeId: node.id,
  headSha: node.headRefOid,
  lifecycle: lifecycleOf(node.state),
  readiness: node.isDraft ? "draft" : "ready-for-review",
  mergeability: node.mergeStateStatus === "CLEAN" ? "clean" : "not-clean",
});

const reviewRecordOf = (node: ReviewNode): ReviewRecord => ({
  stance: stanceOf(node.state),
  reviewedSha: node.commit?.oid ?? null,
});

export {
  graphqlReviewEventOf,
  pullRequestNodeSchema,
  pullRequestSnapshotOf,
  reviewNodeSchema,
  reviewRecordOf,
};
