import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import type { AgentSlug, ArtifactName } from "../../workflow-definition/domain/identities.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { ReviewPolicy, Stage } from "../../workflow-definition/domain/stage.ts";
import type { ReviewClass } from "../../workflow-definition/domain/vocabulary.ts";
import type { Approval } from "./gate.ts";
import { orderOf } from "./moment.ts";
import type { ReviewAttempt, ReviewReceipt } from "./review.ts";
import type { StageAt, WorkflowRecord } from "./workflow-record.ts";

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

const attemptStart = (record: WorkflowRecord, at: StageAt): Timestamp | null =>
  record.approvals.filter((approval) => startsNewAttempt(approval, at) === "new-attempt").at(-1)
    ?.decidedAt ?? null;

const inAttempt = (receipt: ReviewReceipt, start: Timestamp | null): "current" | "earlier" =>
  start === null || orderOf(receipt.attempt.requestedAt, start) === "later" ? "current" : "earlier";

export const attemptReceipts = (record: WorkflowRecord, at: StageAt): readonly ReviewReceipt[] => {
  const start = attemptStart(record, at);
  return record.reviews.filter(
    (receipt) =>
      receipt.attempt.stage === at.stage &&
      receipt.attempt.unit === at.unit &&
      inAttempt(receipt, start) === "current",
  );
};

export const receiptFinality = (receipt: ReviewReceipt, budget: number): "final" | "open" =>
  receipt.verdict === "ready" ||
  receipt.attempt.reviewClass === "advisory" ||
  receipt.attempt.iteration >= budget
    ? "final"
    : "open";

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

const afterReceipts = (
  need: ReviewNeed & { readonly policy: ReviewPolicy },
  receipts: readonly ReviewReceipt[],
): ReviewStep => {
  const budget = reviewBudget(need.reviewClass, need.policy);
  const latest = receipts.at(-1);
  const nextRequest = requestStep(need, receipts.length + 1);
  if (latest === undefined || need.personAsked === "asked") {
    return nextRequest;
  }
  if (latest.verdict === "ready" || latest.attempt.reviewClass === "advisory") {
    return { kind: "finished", receipt: latest };
  }
  return receipts.length >= budget ? { kind: "budget-spent", at: need.at, budget } : nextRequest;
};

export const nextReviewStep = (record: WorkflowRecord, need: ReviewNeed): ReviewStep => {
  const { policy } = need;
  return policy === null || need.reviewClass === "none"
    ? { kind: "no-review", at: need.at }
    : afterReceipts({ ...need, policy }, attemptReceipts(record, need.at));
};

export type ReceiptRefusal =
  | {
      readonly kind: "unexpected-reviewer";
      readonly expected: AgentSlug;
      readonly found: AgentSlug;
    }
  | { readonly kind: "unrequested-iteration"; readonly expected: number; readonly found: number };

export type ReceiptDelivery = {
  readonly receipt: ReviewReceipt;
  readonly requested: ReviewAttempt;
};

export const recordReceipt = (
  record: WorkflowRecord,
  delivery: ReceiptDelivery,
): Result<WorkflowRecord, ReceiptRefusal> => {
  const { receipt, requested } = delivery;
  const { reviewer, iteration } = receipt.attempt;
  if (reviewer !== requested.reviewer) {
    return refused({ kind: "unexpected-reviewer", expected: requested.reviewer, found: reviewer });
  }
  return iteration === requested.iteration
    ? accepted({ ...record, reviews: [...record.reviews, receipt] })
    : refused({ kind: "unrequested-iteration", expected: requested.iteration, found: iteration });
};

export type FreezeQuestion = {
  readonly at: StageAt;
  readonly artifact: ArtifactName;
  readonly budget: number;
};

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

export const artifactFreeze = (record: WorkflowRecord, question: FreezeQuestion): ArtifactFreeze => {
  const latest = attemptReceipts(record, question.at)
    .filter((receipt) => receipt.attempt.artifact === question.artifact)
    .at(-1);
  return latest !== undefined &&
    receiptFinality(latest, question.budget) === "final" &&
    stageCompleted(record, question.at) === "unfinished"
    ? { kind: "frozen", receipt: latest }
    : { kind: "open" };
};
