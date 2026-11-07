// The landed-binding units of the verdict emitter (Slice
// 260816-verdict-landed-binding, IF-13). Every dependency arrives through an
// injected port, so nothing here spawns a process, reads a file, or touches the
// network — the real subprocess paths are proved by the derivation selftest's
// E-series, and these prove the units those paths compose.

import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  type LandedEvidencePorts,
  landedEvidenceOf,
  landedVerdictPayloadOf,
  liveVerdictPayloadOf,
  mergeCommitPatchDigestOf,
  type PullRequestLanding,
  type VerdictInputs,
} from "./rin-gates-review-verdict.ts";

const MERGE_COMMIT = "cafe0000cafe0000cafe0000cafe0000cafe0000";
const REVIEWED_HEAD = "beef1111beef1111beef1111beef1111beef1111";
const PATCH = Buffer.from("diff --git a/x b/x\n+one line\n", "utf8");
const PATCH_DIGEST = createHash("sha256").update(PATCH).digest("hex");
const PULL_REQUEST = 561;
const WORKSPACE = "/minted/repository";
const REVIEWED_AT = "2026-08-16T09:00:00.000Z";

const mergedLanding: PullRequestLanding = {
  state: "MERGED",
  headRefOid: REVIEWED_HEAD,
  mergeCommitOid: MERGE_COMMIT,
};

const portsYielding = (overrides: {
  readonly landing?: PullRequestLanding;
  readonly landingError?: string;
  readonly commitPresent?: boolean;
  readonly patchError?: string;
}): LandedEvidencePorts => ({
  readPullRequestLanding: () =>
    overrides.landingError === undefined
      ? { outcome: "ok", value: overrides.landing ?? mergedLanding }
      : { outcome: "failed", error: overrides.landingError },
  commitExists: () => overrides.commitPresent ?? true,
  readMergeCommitPatch: () =>
    overrides.patchError === undefined
      ? { outcome: "ok", value: PATCH }
      : { outcome: "failed", error: overrides.patchError },
});

const landedRequest = {
  mode: "landed",
  pullRequestNumber: PULL_REQUEST,
  reviewedHeadSha: REVIEWED_HEAD,
  mergeCommitSha: MERGE_COMMIT,
  reviewedAt: null,
} as const;

const inputsWith = (binding: VerdictInputs["binding"]): VerdictInputs => ({
  recordDir: "260816-verdict-landed-binding",
  gate: "rin-gate-5-review-cycle",
  taskId: "019f0000-0000-7000-8000-000000000000",
  verdict: "READY",
  lenses: ["rin-pr-constitution-lens"],
  findings: [],
  blockingFindings: [],
  base: "origin/main",
  gateSegments: ["construction", "rin-gate-5-review-cycle"],
  binding,
});

describe("mergeCommitPatchDigestOf", () => {
  test("digests the patch bytes the port yields", () => {
    const digest = mergeCommitPatchDigestOf({
      mergeCommitSha: MERGE_COMMIT,
      cwd: WORKSPACE,
      readPatch: () => ({ outcome: "ok", value: PATCH }),
    });
    expect(digest).toEqual({ outcome: "ok", value: PATCH_DIGEST });
  });

  test("passes the sha and cwd through to the port unchanged", () => {
    const seen: { sha?: string; cwd?: string } = {};
    mergeCommitPatchDigestOf({
      mergeCommitSha: MERGE_COMMIT,
      cwd: WORKSPACE,
      readPatch: ({ sha, cwd }) => {
        seen.sha = sha;
        seen.cwd = cwd;
        return { outcome: "ok", value: PATCH };
      },
    });
    expect(seen).toEqual({ sha: MERGE_COMMIT, cwd: WORKSPACE });
  });

  test("an unreadable patch fails rather than digesting a forgeable empty string", () => {
    const digest = mergeCommitPatchDigestOf({
      mergeCommitSha: MERGE_COMMIT,
      cwd: WORKSPACE,
      readPatch: () => ({ outcome: "failed", error: "bad object" }),
    });
    expect(digest).toEqual({
      outcome: "failed",
      error: { kind: "merge-commit-patch-unreadable", detail: "bad object" },
    });
  });

  test("the empty patch digests to sha256 of no bytes, never to a failure", () => {
    const digest = mergeCommitPatchDigestOf({
      mergeCommitSha: MERGE_COMMIT,
      cwd: WORKSPACE,
      readPatch: () => ({ outcome: "ok", value: Buffer.alloc(0) }),
    });
    expect(digest).toEqual({
      outcome: "ok",
      value: createHash("sha256").update(Buffer.alloc(0)).digest("hex"),
    });
  });
});

describe("landedEvidenceOf", () => {
  test("a merged PR whose shas agree yields the emitter-computed digest", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({}),
    });
    expect(evidence).toEqual({
      outcome: "ok",
      value: {
        pullRequestNumber: PULL_REQUEST,
        reviewedHeadSha: REVIEWED_HEAD,
        mergeCommitSha: MERGE_COMMIT,
        diffDigest: PATCH_DIGEST,
      },
    });
  });

  test("an unreadable pull request fails before any sha comparison", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({ landingError: "gh: not found" }),
    });
    expect(evidence).toEqual({
      outcome: "failed",
      error: { kind: "pull-request-unreadable", detail: "gh: not found" },
    });
  });

  test("an open pull request reports its state, not a merge-commit mismatch against null", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({
        landing: {
          state: "OPEN",
          headRefOid: REVIEWED_HEAD,
          mergeCommitOid: null,
        },
      }),
    });
    expect(evidence).toEqual({
      outcome: "failed",
      error: { kind: "pull-request-not-merged", state: "OPEN" },
    });
  });

  test("a reviewed head that is not the PR's head fails naming both shas", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({
        landing: { ...mergedLanding, headRefOid: "0000000000000000" },
      }),
    });
    expect(evidence).toEqual({
      outcome: "failed",
      error: {
        kind: "reviewed-head-mismatch",
        expected: REVIEWED_HEAD,
        observed: "0000000000000000",
      },
    });
  });

  test("a merge commit that is not the PR's merge commit fails naming both", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({
        landing: { ...mergedLanding, mergeCommitOid: "1111111111111111" },
      }),
    });
    expect(evidence).toEqual({
      outcome: "failed",
      error: {
        kind: "merge-commit-mismatch",
        expected: MERGE_COMMIT,
        observed: "1111111111111111",
      },
    });
  });

  test("a null merge commit renders as the string null so the union stays total", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({
        landing: { ...mergedLanding, mergeCommitOid: null },
      }),
    });
    expect(evidence).toEqual({
      outcome: "failed",
      error: {
        kind: "merge-commit-mismatch",
        expected: MERGE_COMMIT,
        observed: "null",
      },
    });
  });

  test("a merge commit absent from the clone fails naming the sha", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({ commitPresent: false }),
    });
    expect(evidence).toEqual({
      outcome: "failed",
      error: {
        kind: "merge-commit-unresolvable",
        mergeCommitSha: MERGE_COMMIT,
      },
    });
  });

  test("an unreadable merge-commit patch fails carrying the detail", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({ patchError: "exited 128" }),
    });
    expect(evidence).toEqual({
      outcome: "failed",
      error: { kind: "merge-commit-patch-unreadable", detail: "exited 128" },
    });
  });

  test("the digest tracks the patch bytes: a different patch yields a different digest", () => {
    const otherPatch = Buffer.from("diff --git a/y b/y\n+other line\n", "utf8");
    const overOriginalPatch = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: portsYielding({}),
    });
    const overOtherPatch = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: {
        ...portsYielding({}),
        readMergeCommitPatch: () => ({
          outcome: "ok",
          value: otherPatch,
        }),
      },
    });
    expect(
      overOriginalPatch.outcome === "ok" && overOriginalPatch.value.diffDigest,
    ).toBe(PATCH_DIGEST);
    expect(
      overOtherPatch.outcome === "ok" && overOtherPatch.value.diffDigest,
    ).toBe(createHash("sha256").update(otherPatch).digest("hex"));
  });

  test("the same request over a different patch yields a different digest, so no digest can be caller-supplied", () => {
    const evidence = landedEvidenceOf({
      request: landedRequest,
      workspaceRoot: WORKSPACE,
      ports: {
        ...portsYielding({}),
        readMergeCommitPatch: () => ({
          outcome: "ok",
          value: Buffer.from("a third patch\n", "utf8"),
        }),
      },
    });
    expect(evidence.outcome === "ok" && evidence.value.diffDigest).not.toBe(
      PATCH_DIGEST,
    );
  });
});

describe("liveVerdictPayloadOf", () => {
  const payload = liveVerdictPayloadOf({
    inputs: inputsWith({ mode: "live" }),
    headSha: REVIEWED_HEAD,
    diffDigest: "live-digest",
    reviewedAt: REVIEWED_AT,
  });

  test("the key set and serialisation order pin today's live payload plus the binding", () => {
    expect(Object.keys(payload)).toEqual([
      "gate",
      "taskId",
      "headSha",
      "diffDigest",
      "base",
      "verdict",
      "lenses",
      "findings",
      "blockingFindings",
      "reviewedAt",
      "emittedBy",
      "binding",
    ]);
  });

  test("the live binding carries the same sha as the top-level headSha", () => {
    expect(payload.binding).toEqual({ mode: "live", headSha: REVIEWED_HEAD });
    expect(payload.headSha).toBe(REVIEWED_HEAD);
  });

  test("base and diffDigest keep their existing top-level positions", () => {
    expect(payload.base).toBe("origin/main");
    expect(payload.diffDigest).toBe("live-digest");
  });
});

describe("landedVerdictPayloadOf", () => {
  const payload = landedVerdictPayloadOf({
    inputs: inputsWith(landedRequest),
    evidence: {
      pullRequestNumber: PULL_REQUEST,
      reviewedHeadSha: REVIEWED_HEAD,
      mergeCommitSha: MERGE_COMMIT,
      diffDigest: PATCH_DIGEST,
    },
    reviewedAt: REVIEWED_AT,
  });

  test("the key set and order omit headSha, diffDigest, and base", () => {
    expect(Object.keys(payload)).toEqual([
      "gate",
      "taskId",
      "verdict",
      "lenses",
      "findings",
      "blockingFindings",
      "reviewedAt",
      "emittedBy",
      "binding",
    ]);
  });

  test("no top-level headSha, diffDigest, or base survives serialisation", () => {
    const serialised: unknown = JSON.parse(JSON.stringify(payload));
    expect(serialised).not.toHaveProperty("headSha");
    expect(serialised).not.toHaveProperty("diffDigest");
    expect(serialised).not.toHaveProperty("base");
  });

  test("the landed binding carries all four evidence fields unabbreviated", () => {
    expect(payload.binding).toEqual({
      mode: "landed",
      pullRequestNumber: PULL_REQUEST,
      reviewedHeadSha: REVIEWED_HEAD,
      mergeCommitSha: MERGE_COMMIT,
      diffDigest: PATCH_DIGEST,
    });
  });

  test("the caller-supplied reviewedAt is recorded as given", () => {
    expect(payload.reviewedAt).toBe(REVIEWED_AT);
  });
});
