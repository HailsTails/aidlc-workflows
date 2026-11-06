import type { OpenWorkflowStage } from "../../../core/tools/aidlc-workflow-refresh-contract.ts";
import type { StageRevalidation } from "../../../core/tools/aidlc-stage-refresh-contract.ts";
import { coreRefreshEffectNotes, renderRefreshRevalidationNotes, type AcceptedEffectNote, type StageRecords } from "../../../core/tools/aidlc-refresh-notes.ts";
import type { RinStageRefreshEffect } from "./refresh-contract.ts";

const openAtStage = ({ records }: StageRecords): string => records.length === 0 ? "" : ` Open at this stage: ${records.join(", ")}.`;

const framingAnswersOwed = ({ records }: StageRecords): string =>
  records.length === 0
    ? "no open workflow records Gate 1 as its current stage, so none has questions to answer before resuming."
    : `answer the open Gate 1 questions in ${records.join(", ")} before resuming; nothing rechecks them, and a blank [Answer]: waits for the person only until it is filled or removed, and never under autonomous mode (guide 18, Refresh Safety).`;

export const rinRefreshEffectNotes: Readonly<Record<RinStageRefreshEffect, AcceptedEffectNote>> = {
  ...coreRefreshEffectNotes,
  "framing-decision-record": {
    accepts: "the reviewed #67 prose change",
    follows: framingAnswersOwed,
  },
  "rin-gate-seats": {
    accepts: "the reviewed #82 and #96 rin gate seats and decision records",
    follows: (stage) => "an open record keeps its place and resumes with the rin seats; before its gate is approved it owes a fresh review " +
      "where the reviewer or required outputs changed (Gates 0, 1, 3 and 6), and notes from each named seat where a mob gate's seats changed " +
      `(Gates 1, 2, 3 and 6).${openAtStage(stage)}`,
  },
};

export const rinRefreshRevalidationNotes = (args: {
  readonly stageRevalidation: StageRevalidation<RinStageRefreshEffect>;
  readonly openWorkflows: readonly OpenWorkflowStage[];
}): readonly string[] => renderRefreshRevalidationNotes({ ...args, notes: rinRefreshEffectNotes });
