import { expect, test } from "bun:test";
import { rinRefreshRevalidationNotes as refreshRevalidationNotes } from "./refresh-notes.ts";

test("names each accepted effect in one note that says what follows from it", () => {
  expect(refreshRevalidationNotes({ stageRevalidation: {
    "code-generation": ["plan-approval-questions"],
    "rin-gate-1-framing": ["framing-decision-record"],
    work: ["gate-sensor-coverage", "plan-approval-questions"],
  }, openWorkflows: [
    { workflow: "default/elsewhere", currentStage: "requirements-analysis" },
    { workflow: "other/no-state", currentStage: null },
  ] })).toEqual([
    'Open-workflow refresh accepts the engine-written questions declaration for stage "code-generation" (plan-approval-questions): Plan Approval rechecks a retained code-generation-questions.md before its answer counts.',
    'Open-workflow refresh accepts the reviewed #67 prose change for stage "rin-gate-1-framing" (framing-decision-record): no open workflow records Gate 1 as its current stage, so none has questions to answer before resuming.',
    'Open-workflow refresh accepts wider advisory gate sensor coverage for stage "work" (gate-sensor-coverage): the next gate check reads the added paths.',
    'Open-workflow refresh accepts the engine-written questions declaration for stage "work" (plan-approval-questions): Plan Approval rechecks a retained code-generation-questions.md before its answer counts.',
  ]);
  expect(refreshRevalidationNotes({ stageRevalidation: {}, openWorkflows: [] })).toEqual([]);
});

test("names the open workflows at an accepted stage, leading Gate 1 with the answers they owe", () => {
  expect(refreshRevalidationNotes({ stageRevalidation: {
    "code-generation": ["plan-approval-questions"],
    "rin-gate-1-framing": ["framing-decision-record"],
  }, openWorkflows: [
    { workflow: "default/framing", currentStage: "rin-gate-1-framing" },
    { workflow: "default/building", currentStage: "code-generation" },
    { workflow: "other/parked-framing", currentStage: "rin-gate-1-framing" },
    { workflow: "other/unknown", currentStage: null },
  ] })).toEqual([
    'Open-workflow refresh accepts the engine-written questions declaration for stage "code-generation" (plan-approval-questions): Plan Approval rechecks a retained code-generation-questions.md before its answer counts. Open at this stage: default/building.',
    'Open-workflow refresh accepts the reviewed #67 prose change for stage "rin-gate-1-framing" (framing-decision-record): answer the open Gate 1 questions in default/framing, other/parked-framing before resuming; nothing rechecks them, and a blank [Answer]: waits for the person only until it is filled or removed, and never under autonomous mode (guide 18, Refresh Safety).',
  ]);
});

test("names the open workflows resuming an accepted rin gate with its new seats", () => {
  expect(refreshRevalidationNotes({ stageRevalidation: {
    "rin-gate-0-reconcile": ["rin-gate-seats"],
    "rin-gate-3-interface-lock": ["rin-gate-seats"],
  }, openWorkflows: [
    { workflow: "default/locking", currentStage: "rin-gate-3-interface-lock" },
  ] })).toEqual([
    "Open-workflow refresh accepts the reviewed #82 and #96 rin gate seats and decision records for stage \"rin-gate-0-reconcile\" (rin-gate-seats): an open record keeps its place and resumes with the rin seats; before its gate is approved it owes a fresh review where the reviewer or required outputs changed (Gates 0, 1, 3 and 6), and notes from each named seat where a mob gate's seats changed (Gates 1, 2, 3 and 6).",
    "Open-workflow refresh accepts the reviewed #82 and #96 rin gate seats and decision records for stage \"rin-gate-3-interface-lock\" (rin-gate-seats): an open record keeps its place and resumes with the rin seats; before its gate is approved it owes a fresh review where the reviewer or required outputs changed (Gates 0, 1, 3 and 6), and notes from each named seat where a mob gate's seats changed (Gates 1, 2, 3 and 6). Open at this stage: default/locking.",
  ]);
});
