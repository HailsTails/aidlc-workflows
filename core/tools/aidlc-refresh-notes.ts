import type { OpenWorkflowStage } from "./aidlc-workflow-refresh-contract.ts";
import type { StageRefreshEffect } from "./aidlc-stage-refresh-contract.ts";
import type { StageRevalidation } from "./aidlc-stage-refresh-contract.ts";

export type StageRecords = { readonly records: readonly string[] };
export type AcceptedEffectNote = { readonly accepts: string; readonly follows: (args: StageRecords) => string };

const openAtStage = ({ records }: StageRecords): string =>
  records.length === 0 ? "" : ` Open at this stage: ${records.join(", ")}.`;

export const coreRefreshEffectNotes: Readonly<Record<StageRefreshEffect, AcceptedEffectNote>> = {
  "gate-sensor-coverage": {
    accepts: "wider advisory gate sensor coverage",
    follows: (stage) => `the next gate check reads the added paths.${openAtStage(stage)}`,
  },
  "plan-approval-questions": {
    accepts: "the engine-written questions declaration",
    follows: (stage) => `Plan Approval rechecks a retained code-generation-questions.md before its answer counts.${openAtStage(stage)}`,
  },

};

const acceptedEffectNote = <Effect extends string>(args: { readonly stage: string; readonly effect: Effect; readonly records: readonly string[]; readonly notes: Readonly<Record<Effect, AcceptedEffectNote>> }): string => {
  const note = args.notes[args.effect];
  return `Open-workflow refresh accepts ${note.accepts} for stage ${JSON.stringify(args.stage)} (${args.effect}): ${note.follows(args)}`;
};

const recordsAt = (args: { readonly stage: string; readonly openWorkflows: readonly OpenWorkflowStage[] }): readonly string[] =>
  args.openWorkflows.filter((open) => open.currentStage === args.stage).map((open) => open.workflow);

export const renderRefreshRevalidationNotes = <Effect extends string>(args: {
  readonly notes: Readonly<Record<Effect, AcceptedEffectNote>>;
  readonly stageRevalidation: StageRevalidation<Effect>;
  readonly openWorkflows: readonly OpenWorkflowStage[];
}): readonly string[] =>
  Object.entries(args.stageRevalidation).flatMap(([stage, effects]) => {
    const records = recordsAt({ stage, openWorkflows: args.openWorkflows });
    return effects.map((effect) => acceptedEffectNote({ stage, effect, records, notes: args.notes }));
  });

export const refreshRevalidationNotes = (args: {
  readonly stageRevalidation: StageRevalidation;
  readonly openWorkflows: readonly OpenWorkflowStage[];
}): readonly string[] => renderRefreshRevalidationNotes({ ...args, notes: coreRefreshEffectNotes });
