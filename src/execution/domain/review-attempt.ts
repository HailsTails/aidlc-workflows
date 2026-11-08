import type { Timestamp } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { ReviewPolicy, Stage } from "../../workflow-definition/domain/stage.ts";
import type { ReviewClass } from "../../workflow-definition/domain/vocabulary.ts";
import type { Approval } from "./gate.ts";
import { orderOf } from "./moment.ts";
import type { ReviewAttempt, ReviewReceipt } from "./review.ts";
import { appliedApprovals, type StageAt, type WorkflowRecord } from "./workflow-record.ts";

const CLASS_RANK: Readonly<Record<ReviewClass, number>> = {
  none: 0,
  advisory: 1,
  adversarial: 2,
};

export type ReviewClassSources = {
  readonly declared: ReviewPolicy | null;
  readonly override: ReviewClass | null;
  readonly scopeCap: ReviewClass | null;
};

const lower = (declared: ReviewClass, ceiling: ReviewClass): ReviewClass =>
  CLASS_RANK[ceiling] < CLASS_RANK[declared] ? ceiling : declared;

export const reviewClassFor = (sources: ReviewClassSources): ReviewClass => {
  const declared = sources.declared?.reviewClass ?? "none";
  const ceiling = sources.override ?? sources.scopeCap ?? declared;
  return lower(declared, ceiling);
};

export type StageInMethod = {
  readonly method: Method;
  readonly stage: Stage;
};

export const stageReviewClass = (record: WorkflowRecord, placed: StageInMethod): ReviewClass =>
  reviewClassFor({
    declared: placed.stage.review,
    override: record.settings.reviewOverride,
    scopeCap: placed.method.scopes.find((scope) => scope.name === record.scope)?.reviewCap ?? null,
  });

export const reviewBudget = (reviewClass: ReviewClass, policy: ReviewPolicy | null): number => {
  switch (reviewClass) {
    case "none":
      return 0;
    case "advisory":
      return 1;
    case "adversarial":
      return policy?.maxIterations ?? 0;
  }
};

const startsNewAttempt = (approval: Approval, at: StageAt): "new-attempt" | "same-attempt" =>
  approval.decision.kind === "jump" ||
  (approval.gate.kind === "stage" &&
    approval.gate.stage === at.stage &&
    approval.gate.unit === at.unit &&
    approval.decision.kind === "request-changes")
    ? "new-attempt"
    : "same-attempt";

export const attemptStart = (record: WorkflowRecord, at: StageAt): Timestamp | null =>
  appliedApprovals(record)
    .filter((approval) => startsNewAttempt(approval, at) === "new-attempt")
    .at(-1)?.decidedAt ?? null;

export const sinceAttemptStart = (moment: Timestamp, start: Timestamp | null): "current" | "earlier" =>
  start === null || orderOf(moment, start) === "later" ? "current" : "earlier";

export const attemptReceipts = (record: WorkflowRecord, at: StageAt): readonly ReviewReceipt[] => {
  const start = attemptStart(record, at);
  return record.reviews.filter(
    (receipt) =>
      receipt.attempt.stage === at.stage &&
      receipt.attempt.unit === at.unit &&
      sinceAttemptStart(receipt.attempt.requestedAt, start) === "current",
  );
};

export type AttemptQuestion = {
  readonly at: StageAt;
  readonly budget: number;
};

export type AttemptStanding =
  | { readonly kind: "open"; readonly receipts: readonly ReviewReceipt[] }
  | { readonly kind: "finished"; readonly receipt: ReviewReceipt }
  | { readonly kind: "spent"; readonly receipt: ReviewReceipt; readonly budget: number };

export const attemptStanding = (record: WorkflowRecord, question: AttemptQuestion): AttemptStanding => {
  const receipts = attemptReceipts(record, question.at);
  const latest = receipts.at(-1);
  if (latest === undefined) {
    return { kind: "open", receipts };
  }
  if (latest.verdict === "ready" || latest.attempt.reviewClass === "advisory") {
    return { kind: "finished", receipt: latest };
  }
  return receipts.length >= question.budget
    ? { kind: "spent", receipt: latest, budget: question.budget }
    : { kind: "open", receipts };
};

export type ReviewNeed = {
  readonly at: StageAt;
  readonly policy: ReviewPolicy | null;
  readonly reviewClass: ReviewClass;
  readonly personAsked: "asked" | "not-asked";
  readonly time: Timestamp;
};

export type ReviewStep =
  | { readonly kind: "request"; readonly attempt: ReviewAttempt }
  | { readonly kind: "no-review"; readonly at: StageAt }
  | { readonly kind: "finished"; readonly receipt: ReviewReceipt }
  | { readonly kind: "budget-spent"; readonly at: StageAt; readonly budget: number };

const requestStep = (
  need: ReviewNeed & { readonly policy: ReviewPolicy },
  iteration: number,
): ReviewStep => ({
  kind: "request",
  attempt: {
    stage: need.at.stage,
    unit: need.at.unit,
    artifact: need.policy.artifact,
    reviewer: need.policy.reviewer,
    reviewClass: need.reviewClass === "advisory" ? "advisory" : "adversarial",
    iteration,
    requestedAt: need.time,
  },
});

const stepFrom = (
  need: ReviewNeed & { readonly policy: ReviewPolicy },
  standing: AttemptStanding,
): ReviewStep => {
  switch (standing.kind) {
    case "open":
      return requestStep(need, standing.receipts.length + 1);
    case "finished":
      return { kind: "finished", receipt: standing.receipt };
    case "spent":
      return { kind: "budget-spent", at: need.at, budget: standing.budget };
  }
};

const reviewedStep = (
  record: WorkflowRecord,
  need: ReviewNeed & { readonly policy: ReviewPolicy },
): ReviewStep =>
  need.personAsked === "asked"
    ? requestStep(need, attemptReceipts(record, need.at).length + 1)
    : stepFrom(
        need,
        attemptStanding(record, { at: need.at, budget: reviewBudget(need.reviewClass, need.policy) }),
      );

export const nextReviewStep = (record: WorkflowRecord, need: ReviewNeed): ReviewStep => {
  const { policy } = need;
  return policy === null || need.reviewClass === "none"
    ? { kind: "no-review", at: need.at }
    : reviewedStep(record, { ...need, policy });
};

export const withReceipt = (record: WorkflowRecord, receipt: ReviewReceipt): WorkflowRecord => ({
  ...record,
  reviews: [...record.reviews, receipt],
});

export type ArtifactFreeze =
  | { readonly kind: "frozen"; readonly receipt: ReviewReceipt }
  | { readonly kind: "open" };

const stageCompleted = (record: WorkflowRecord, at: StageAt): "completed" | "unfinished" =>
  record.stages.some(
    (state) =>
      state.stage === at.stage && state.unit === at.unit && state.progress === "completed",
  )
    ? "completed"
    : "unfinished";

export const artifactFreeze = (record: WorkflowRecord, question: AttemptQuestion): ArtifactFreeze => {
  const standing = attemptStanding(record, question);
  return standing.kind !== "open" && stageCompleted(record, question.at) === "unfinished"
    ? { kind: "frozen", receipt: standing.receipt }
    : { kind: "open" };
};
