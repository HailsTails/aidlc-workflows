import { describe, expect, it } from "vitest";
import {
  graphqlReviewEventOf,
  pullRequestNodeSchema,
  pullRequestSnapshotOf,
  reviewNodeSchema,
  reviewRecordOf,
} from "./github-pull-request-wire.ts";

const openNode = {
  id: "PR_node12",
  number: 12,
  headRefOid: "head12",
  state: "OPEN",
  isDraft: false,
  mergeStateStatus: "CLEAN",
} as const;

describe("pullRequestSnapshotOf", () => {
  it("maps an open, clean, ready pull request", () => {
    expect(pullRequestSnapshotOf(openNode)).toEqual({
      pullNumber: 12,
      nodeId: "PR_node12",
      headSha: "head12",
      lifecycle: "open",
      readiness: "ready-for-review",
      mergeability: "clean",
    });
  });

  it("maps a merged draft whose merge state is not clean", () => {
    expect(
      pullRequestSnapshotOf({
        ...openNode,
        state: "MERGED",
        isDraft: true,
        mergeStateStatus: "DIRTY",
      }),
    ).toEqual(
      expect.objectContaining({
        lifecycle: "merged",
        readiness: "draft",
        mergeability: "not-clean",
      }),
    );
  });

  it("maps a closed pull request", () => {
    expect(pullRequestSnapshotOf({ ...openNode, state: "CLOSED" })).toEqual(
      expect.objectContaining({ lifecycle: "closed" }),
    );
  });
});

describe("reviewRecordOf", () => {
  it("maps each review state to a stance with the reviewed commit", () => {
    expect([
      reviewRecordOf({ state: "APPROVED", commit: { oid: "a" } }),
      reviewRecordOf({ state: "CHANGES_REQUESTED", commit: { oid: "b" } }),
      reviewRecordOf({ state: "COMMENTED", commit: { oid: "c" } }),
      reviewRecordOf({ state: "DISMISSED", commit: { oid: "d" } }),
      reviewRecordOf({ state: "PENDING", commit: null }),
    ]).toEqual([
      { stance: "approved", reviewedSha: "a" },
      { stance: "changes-requested", reviewedSha: "b" },
      { stance: "commented", reviewedSha: "c" },
      { stance: "dismissed", reviewedSha: "d" },
      { stance: "pending", reviewedSha: null },
    ]);
  });
});

describe("graphqlReviewEventOf", () => {
  it("names each review event the way the GraphQL enum does", () => {
    expect([
      graphqlReviewEventOf("approve"),
      graphqlReviewEventOf("request-changes"),
      graphqlReviewEventOf("comment"),
    ]).toEqual(["APPROVE", "REQUEST_CHANGES", "COMMENT"]);
  });
});

describe("wire schemas", () => {
  it("rejects a pull request state GitHub does not define", () => {
    expect(pullRequestNodeSchema.safeParse({ ...openNode, state: "LOCKED" }).success).toBe(false);
  });

  it("accepts a review whose commit is gone", () => {
    expect(reviewNodeSchema.safeParse({ state: "APPROVED", commit: null }).success).toBe(true);
  });
});
