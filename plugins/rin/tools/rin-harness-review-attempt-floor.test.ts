import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  currentPipelineLinkReceipts,
  latestMainWorkflowStageRunFloor,
  latestMainWorkflowStageRunFloorForProject,
  reviewAttemptWindow,
} from "../../../core/tools/aidlc-lib.ts";

const RECORD = "fixture-floor-record";
const STAGE = "rin-gate-0-reconcile";
const PHASE = "inception";
const REVIEWER = "aidlc-architecture-reviewer-agent";

// The stage's declared `produces:`. From 2.7.0 the engine refuses a review
// request whose stage is missing any of them, BEFORE it reaches the ordinal
// check these tests are about — so a fixture without them fails on the wrong
// refusal and proves nothing about the attempt floor. Writing them keeps each
// test's subject the floor rather than the artifact guard. Deliberately NOT
// AIDLC_SKIP_ARTIFACT_GUARD=1: routing around a guard to make a test pass is
// the move this repo's drift register already rejected once.
const REQUIRED_STAGE_ARTIFACTS = [
  "rin-reconcile-report",
  "rin-readiness-verdict",
] as const;

// WHY THESE ASSERT BEHAVIOUR RATHER THAN AN ORDINAL (changed with the 2.7.x
// engine install, PR #852).
//
// These four cases were written against the 2.6.54 payload, where a floored
// attempt produced "expected 2 from the current audit attempt" and an unfloored
// one produced "review request 3 exceeds this stage's review budget". Both
// numbers were read straight out of the CLI refusal text.
//
// 2.7.x changed two things. The refusals were reworded, and — measured, not
// inferred — the floor now RESETS the ordinal to 1 rather than continuing from
// the pre-rejection count. Worse for a CLI-level assertion: through
// `aidlc-log.ts review` a floored and an unfloored attempt became
// indistinguishable, both accepting iteration 1 and both reporting "the next
// iteration is 1" at iteration 2.
//
// The ordinal is presentational. The contract #888 protects is the
// DISCRIMINATION: a human rejection forces a fresh review attempt, a machine
// backfill does not consume the budget. That still holds exactly, and is still
// observable — `reviewAttemptWindow` resolves floorIdx=2 for a human rejection,
// -1 for a Recovered:true backfill, and 2 for an explicit Recovered:false, on
// the same fixtures. So these assert the boundary the engine resolved instead
// of a number it happens to print. Not an upstream regression: rin does not
// depend on the numbering.

const writeRequiredStageArtifacts = (record: string): void => {
  const stageDir = join(record, PHASE, STAGE);
  mkdirSync(stageDir, { recursive: true });
  REQUIRED_STAGE_ARTIFACTS.forEach((artifact) => {
    writeFileSync(
      join(stageDir, `${artifact}.md`),
      `# ${artifact}\n\nFixture content for the review-attempt floor tests.\n`,
      "utf-8",
    );
  });
};

const sandboxes: string[] = [];

afterAll(() => {
  sandboxes.splice(0).forEach((path) => {
    rmSync(path, { recursive: true, force: true });
  });
});

const auditBlock = (lines: readonly string[]): string =>
  `${lines.join("\n")}\n\n---\n\n`;

const gateRejected = ({
  recoveredTag,
  timestamp,
  stage = STAGE,
}: {
  readonly recoveredTag: string | null;
  readonly timestamp: string;
  readonly stage?: string;
}): string =>
  auditBlock([
    "## Gate Rejected",
    `**Timestamp**: ${timestamp}`,
    "**Event**: GATE_REJECTED",
    `**Stage**: ${stage}`,
    ...(recoveredTag === null ? [] : [`**Recovered**: ${recoveredTag}`]),
    "**Details**: fixture",
  ]);

const reviewPair = ({
  iteration,
  requestedAt,
  completedAt,
}: {
  readonly iteration: number;
  readonly requestedAt: string;
  readonly completedAt: string;
}): string =>
  auditBlock([
    "## Review Requested",
    `**Timestamp**: ${requestedAt}`,
    "**Event**: REVIEW_REQUESTED",
    `**Stage**: ${STAGE}`,
    `**Reviewer**: ${REVIEWER}`,
    `**Iteration**: ${iteration}`,
  ]) +
  auditBlock([
    "## Review Completed",
    `**Timestamp**: ${completedAt}`,
    "**Event**: REVIEW_COMPLETED",
    `**Stage**: ${STAGE}`,
    `**Reviewer**: ${REVIEWER}`,
    `**Iteration**: ${iteration}`,
    "**Verdict**: READY",
  ]);

const stateFile = [
  "# AI-DLC State Tracking",
  "",
  "## Project Information",
  "- **Project**: fixture",
  "- **Scope**: rin-gates",
  "",
  "## Runtime State",
  "- **Revision Count**: 0",
  "",
  "## Stage Progress",
  `- [?] ${STAGE} — EXECUTE`,
  "",
  "## Current Status",
  `- **Current Stage**: ${STAGE}`,
  "- **Status**: Running",
  "",
].join("\n");

const sandboxWithRecoveredTag = ({
  recoveredTag,
  rejectionStage = STAGE,
}: {
  readonly recoveredTag: string | null;
  readonly rejectionStage?: string;
}): string => {
  const root = mkdtempSync(join(tmpdir(), "rin-floor-"));
  sandboxes.push(root);
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const record = join(intents, RECORD);
  mkdirSync(join(record, "audit"), { recursive: true });
  writeFileSync(join(intents, "active-intent"), RECORD, "utf-8");
  writeFileSync(join(record, "aidlc-state.md"), stateFile, "utf-8");
  writeRequiredStageArtifacts(record);
  writeFileSync(
    join(record, "audit", "fixture.md"),
    `# AI-DLC Audit Log\n\n${reviewPair({
      iteration: 1,
      requestedAt: "2026-08-23T04:00:00Z",
      completedAt: "2026-08-23T04:05:00Z",
    })}${gateRejected({
      recoveredTag,
      timestamp: "2026-08-23T05:00:00Z",
      stage: rejectionStage,
    })}${reviewPair({
      iteration: 1,
      requestedAt: "2026-08-23T06:00:00Z",
      completedAt: "2026-08-23T06:05:00Z",
    })}`,
    "utf-8",
  );
  return root;
};

const sandboxWithHumanRejection = (): string =>
  sandboxWithRecoveredTag({ recoveredTag: null });

const sandboxWithMachineBackfill = (): string =>
  sandboxWithRecoveredTag({ recoveredTag: "true" });

const sandboxWithExplicitRecoveredFalse = (): string =>
  sandboxWithRecoveredTag({ recoveredTag: "false" });

const sandboxWithOtherStageRejection = (): string =>
  sandboxWithRecoveredTag({
    recoveredTag: null,
    rejectionStage: "rin-gate-4-implement",
  });

const sandboxWithUnmatchedRequestBeforeRejection = ({
  recoveredTag,
}: {
  readonly recoveredTag: string | null;
}): string => {
  const root = mkdtempSync(join(tmpdir(), "rin-floor-pending-"));
  sandboxes.push(root);
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const record = join(intents, RECORD);
  mkdirSync(join(record, "audit"), { recursive: true });
  writeFileSync(join(intents, "active-intent"), RECORD, "utf-8");
  writeFileSync(join(record, "aidlc-state.md"), stateFile, "utf-8");
  writeRequiredStageArtifacts(record);
  writeFileSync(
    join(record, "audit", "fixture.md"),
    `# AI-DLC Audit Log\n\n${auditBlock([
      "## Review Requested",
      "**Timestamp**: 2026-08-23T04:00:00Z",
      "**Event**: REVIEW_REQUESTED",
      `**Stage**: ${STAGE}`,
      `**Reviewer**: ${REVIEWER}`,
      "**Iteration**: 7",
    ])}${gateRejected({
      recoveredTag,
      timestamp: "2026-08-23T05:00:00Z",
    })}`,
    "utf-8",
  );
  return root;
};

const sandboxWithLinkBeforeRejection = ({
  recoveredTag,
}: {
  readonly recoveredTag: string | null;
}): string => {
  const root = mkdtempSync(join(tmpdir(), "rin-floor-link-"));
  sandboxes.push(root);
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const record = join(intents, RECORD);
  mkdirSync(join(record, "audit"), { recursive: true });
  writeFileSync(join(intents, "active-intent"), RECORD, "utf-8");
  writeFileSync(join(record, "aidlc-state.md"), stateFile, "utf-8");
  writeFileSync(
    join(record, "audit", "fixture.md"),
    `# AI-DLC Audit Log\n\n${auditBlock([
      "## Pipeline Link Completed",
      "**Timestamp**: 2026-08-23T04:00:00Z",
      "**Event**: PIPELINE_LINK_COMPLETED",
      `**Stage**: ${STAGE}`,
      "**Link**: fixture-link",
    ])}${gateRejected({
      recoveredTag,
      timestamp: "2026-08-23T05:00:00Z",
    })}`,
    "utf-8",
  );
  return root;
};

// The floor's OBSERVABLE consequence: a floored attempt starts a fresh review
// window, so every review event before the rejection is outside it. An
// unfloored one keeps them. `floorIndexFor` reports the boundary the engine
// resolved; a non-negative index means the rejection floored the attempt.
const floorIndexFor = (projectDir: string): number =>
  reviewAttemptWindow(projectDir, stateFile, { slug: STAGE }).floorIdx;

const NOT_FLOORED = -1;

describe("the shipped review-attempt floor in .claude/tools/aidlc-lib.ts", () => {
  test("a HUMAN gate rejection floors the attempt, so the reviews before it are outside the window", () => {
    const projectDir = sandboxWithHumanRejection();

    expect(floorIndexFor(projectDir)).toBeGreaterThan(NOT_FLOORED);
  });

  test("a MACHINE backfill tagged Recovered does NOT floor the attempt, so the reviews before it still count", () => {
    const projectDir = sandboxWithMachineBackfill();

    expect(floorIndexFor(projectDir)).toBe(NOT_FLOORED);
  });

  test("an explicit Recovered false is a human decision and still floors, so the tag is read as a value and not merely as a present key", () => {
    const projectDir = sandboxWithExplicitRecoveredFalse();

    expect(floorIndexFor(projectDir)).toBeGreaterThan(NOT_FLOORED);
  });

  test("a human rejection recorded against a DIFFERENT stage does not floor this stage's attempt, so the exclusion is not simply ignoring every rejection", () => {
    const projectDir = sandboxWithOtherStageRejection();

    expect(floorIndexFor(projectDir)).toBe(NOT_FLOORED);
  });
});

const auditWithRejectionBetweenReviews = ({
  recoveredTag,
}: {
  readonly recoveredTag: string | null;
}): string =>
  `# AI-DLC Audit Log\n\n${reviewPair({
    iteration: 1,
    requestedAt: "2026-08-23T04:00:00Z",
    completedAt: "2026-08-23T04:05:00Z",
  })}${gateRejected({
    recoveredTag,
    timestamp: "2026-08-23T05:00:00Z",
  })}${reviewPair({
    iteration: 1,
    requestedAt: "2026-08-23T06:00:00Z",
    completedAt: "2026-08-23T06:05:00Z",
  })}`;

describe("latestMainWorkflowStageRunFloor in .claude/tools/aidlc-lib.ts", () => {
  test("a HUMAN gate rejection becomes the run floor", () => {
    const floor = latestMainWorkflowStageRunFloor(
      auditWithRejectionBetweenReviews({ recoveredTag: null }),
      STAGE,
    );

    expect(floor).toBe("GATE_REJECTED:2026-08-23T05:00:00Z#1");
  });

  test("a MACHINE backfill tagged Recovered is not the run floor, so the attempt reads as unstarted", () => {
    const floor = latestMainWorkflowStageRunFloor(
      auditWithRejectionBetweenReviews({ recoveredTag: "true" }),
      STAGE,
    );

    expect(floor).toBe("unstarted#0");
  });
});

describe("freshReviewReceipts in .claude/tools/aidlc-lib.ts — the reader that feeds the review-freeze write rail", () => {
  // Same rewrite as the floor cases above, and for a sharper reason: under
  // 2.7.x `stagePending` is null for BOTH tags on this fixture (measured), so
  // the pair no longer discriminates — the human case passed only because null
  // is what it expected. Asserting the window the reader derives keeps both
  // halves meaningful instead of leaving one vacuous.
  test("a HUMAN gate rejection floors the receipt scan, so a request made before it is out of the attempt", () => {
    const projectDir = sandboxWithUnmatchedRequestBeforeRejection({
      recoveredTag: null,
    });

    expect(floorIndexFor(projectDir)).toBeGreaterThan(NOT_FLOORED);
  });

  test("a MACHINE backfill tagged Recovered does not floor the receipt scan, so the earlier request is still pending in the attempt", () => {
    const projectDir = sandboxWithUnmatchedRequestBeforeRejection({
      recoveredTag: "true",
    });

    expect(floorIndexFor(projectDir)).toBe(NOT_FLOORED);
  });
});

describe("pipelineAttemptFloor in .claude/tools/aidlc-lib.ts, through its exported caller", () => {
  test("a HUMAN gate rejection floors the pipeline attempt, so a link recorded before it is out of scope", () => {
    const projectDir = sandboxWithLinkBeforeRejection({ recoveredTag: null });

    const receipts = currentPipelineLinkReceipts(projectDir, STAGE);

    expect(receipts).toEqual([]);
  });

  test("a recovered production revision invalidates earlier pipeline links", () => {
    const projectDir = sandboxWithLinkBeforeRejection({ recoveredTag: "true" });

    const receipts = currentPipelineLinkReceipts(projectDir, STAGE);

    expect(receipts).toEqual([]);
  });
});

describe("latestMainWorkflowStageRunFloorForProject in .claude/tools/aidlc-lib.ts — the reader with the most callers, which the first fix missed", () => {
  test("a HUMAN gate rejection becomes the run floor", () => {
    const projectDir = sandboxWithHumanRejection();

    const floor = latestMainWorkflowStageRunFloorForProject(projectDir, STAGE);

    expect(floor).toBe("GATE_REJECTED:2026-08-23T05:00:00Z#1");
  });

  test("a MACHINE backfill tagged Recovered is not the run floor, so the attempt reads as unstarted", () => {
    const projectDir = sandboxWithMachineBackfill();

    const floor = latestMainWorkflowStageRunFloorForProject(projectDir, STAGE);

    expect(floor).toBe("unstarted#0");
  });
});
