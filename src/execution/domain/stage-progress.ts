import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { NonEmptyArray, Timestamp } from "../../kernel/values.ts";
import type { StageSlug } from "../../workflow-definition/domain/identities.ts";
import type { UnitName } from "./identities.ts";
import type { Transition, TransitionCause } from "./transition.ts";
import {
  progressFinished,
  type RecordChange,
  type RecordMoveRefusal,
  type StageAt,
  type StageProgress,
  type StageState,
  type WorkflowRecord,
} from "./workflow-record.ts";

export type StageMove = "start" | "submit" | "approve" | "request-changes" | "skip";

type MoveRule = {
  readonly from: NonEmptyArray<StageProgress>;
  readonly to: StageProgress;
};

const IN_FLIGHT: NonEmptyArray<StageProgress> = [
  "pending",
  "in-progress",
  "awaiting-approval",
  "revising",
];

const STAGE_MOVES: Readonly<Record<StageMove, MoveRule>> = {
  start: { from: ["pending"], to: "in-progress" },
  submit: { from: ["in-progress", "revising"], to: "awaiting-approval" },
  approve: { from: ["awaiting-approval"], to: "completed" },
  "request-changes": { from: ["awaiting-approval", "in-progress"], to: "revising" },
  skip: { from: IN_FLIGHT, to: "skipped" },
};

export type StageMoveRequest = {
  readonly at: StageAt;
  readonly move: StageMove;
  readonly cause: TransitionCause;
  readonly time: Timestamp;
};

export type JumpRequest = {
  readonly to: StageSlug;
  readonly cause: TransitionCause;
  readonly time: Timestamp;
};

type ProgressChange = {
  readonly position: number;
  readonly to: StageProgress;
};

type ChangeSet = {
  readonly changes: readonly ProgressChange[];
  readonly cause: TransitionCause;
  readonly time: Timestamp;
};

const stageTransition = (state: StageState, change: ProgressChange & ChangeSet): Transition => ({
  kind: "stage",
  stage: state.stage,
  unit: state.unit,
  from: state.progress,
  to: change.to,
  cause: change.cause,
  at: change.time,
});

const applyChanges = (record: WorkflowRecord, changeSet: ChangeSet): RecordChange => {
  const targets = new Map(changeSet.changes.map((change) => [change.position, change.to]));
  return {
    record: {
      ...record,
      stages: record.stages.map((state, position) => ({
        ...state,
        progress: targets.get(position) ?? state.progress,
      })),
    },
    transitions: changeSet.changes.flatMap((change) => {
      const state = record.stages[change.position];
      return state === undefined ? [] : [stageTransition(state, { ...changeSet, ...change })];
    }),
  };
};

const notRunning = (record: WorkflowRecord): Result<never, RecordMoveRefusal> =>
  refused({ kind: "workflow-status", status: record.status, needed: "running" });

const moveFound = (
  record: WorkflowRecord,
  request: StageMoveRequest & { readonly position: number; readonly state: StageState },
): Result<RecordChange, RecordMoveRefusal> => {
  const rule = STAGE_MOVES[request.move];
  return rule.from.includes(request.state.progress)
    ? accepted(applyChanges(record, { ...request, changes: [{ ...request, to: rule.to }] }))
    : refused({ kind: "stage-out-of-order", at: request.state, allowedFrom: rule.from });
};

const moveRunning = (
  record: WorkflowRecord,
  request: StageMoveRequest,
): Result<RecordChange, RecordMoveRefusal> => {
  const position = record.stages.findIndex(
    (state) => state.stage === request.at.stage && state.unit === request.at.unit,
  );
  const state = record.stages[position];
  return state === undefined
    ? refused({ kind: "stage-not-in-plan", ...request.at })
    : moveFound(record, { ...request, position, state });
};

export type ProgressSetting = {
  readonly at: StageAt;
  readonly to: StageProgress;
  readonly cause: TransitionCause;
  readonly time: Timestamp;
};

const settingFound = (
  record: WorkflowRecord,
  setting: ProgressSetting & { readonly position: number; readonly state: StageState },
): RecordChange =>
  setting.state.progress === setting.to
    ? { record, transitions: [] }
    : applyChanges(record, { ...setting, changes: [{ position: setting.position, to: setting.to }] });

const setRunning = (
  record: WorkflowRecord,
  setting: ProgressSetting,
): Result<RecordChange, RecordMoveRefusal> => {
  const position = record.stages.findIndex(
    (state) => state.stage === setting.at.stage && state.unit === setting.at.unit,
  );
  const state = record.stages[position];
  return state === undefined
    ? refused({ kind: "stage-not-in-plan", ...setting.at })
    : accepted(settingFound(record, { ...setting, position, state }));
};

export const setStageProgress = (
  record: WorkflowRecord,
  setting: ProgressSetting,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "running" ? setRunning(record, setting) : notRunning(record);

export type UnitRevision = {
  readonly unit: UnitName;
  readonly stages: readonly StageSlug[];
  readonly cause: TransitionCause;
  readonly time: Timestamp;
};

const revisedPositions = (
  record: WorkflowRecord,
  revision: UnitRevision,
): readonly ProgressChange[] =>
  record.stages.flatMap((state, position): readonly ProgressChange[] =>
    state.unit === revision.unit &&
    revision.stages.includes(state.stage) &&
    state.progress !== "revising"
      ? [{ position, to: "revising" }]
      : [],
  );

export const reviseUnit = (
  record: WorkflowRecord,
  revision: UnitRevision,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "running"
    ? accepted(applyChanges(record, { ...revision, changes: revisedPositions(record, revision) }))
    : notRunning(record);

export const moveStage = (
  record: WorkflowRecord,
  request: StageMoveRequest,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "running" ? moveRunning(record, request) : notRunning(record);

type JumpFrame = {
  readonly target: StageSlug;
  readonly firstTarget: number;
  readonly current: number;
};

type PlacedStage = {
  readonly state: StageState;
  readonly position: number;
};

const currentPosition = (stages: readonly StageState[]): number => {
  const position = stages.findIndex((state) => progressFinished(state.progress) === "unfinished");
  return position === -1 ? stages.length : position;
};

const inFlight = (progress: StageProgress): "in-flight" | "settled" =>
  IN_FLIGHT.includes(progress) ? "in-flight" : "settled";

const passedOver = ({ state, position }: PlacedStage, frame: JumpFrame): StageProgress =>
  position >= frame.current &&
  position < frame.firstTarget &&
  inFlight(state.progress) === "in-flight"
    ? "skipped"
    : state.progress;

const startedOver = (placed: PlacedStage, frame: JumpFrame): StageProgress =>
  frame.firstTarget < frame.current && placed.position > frame.firstTarget
    ? "pending"
    : passedOver(placed, frame);

const targetProgress = (position: number, frame: JumpFrame): StageProgress =>
  position === frame.firstTarget ? "in-progress" : "pending";

const jumpedProgress = (placed: PlacedStage, frame: JumpFrame): StageProgress =>
  placed.state.stage === frame.target
    ? targetProgress(placed.position, frame)
    : startedOver(placed, frame);

const jumpChanges = (stages: readonly StageState[], frame: JumpFrame): readonly ProgressChange[] =>
  stages.flatMap((state, position) => {
    const to = jumpedProgress({ state, position }, frame);
    return to === state.progress ? [] : [{ position, to }];
  });

const jumpRunning = (
  record: WorkflowRecord,
  request: JumpRequest,
): Result<RecordChange, RecordMoveRefusal> => {
  const firstTarget = record.stages.findIndex((state) => state.stage === request.to);
  const frame = { target: request.to, firstTarget, current: currentPosition(record.stages) };
  return firstTarget === -1
    ? refused({ kind: "stage-not-in-plan", stage: request.to, unit: null })
    : accepted(applyChanges(record, { ...request, changes: jumpChanges(record.stages, frame) }));
};

export const jumpToStage = (
  record: WorkflowRecord,
  request: JumpRequest,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "running" ? jumpRunning(record, request) : notRunning(record);
