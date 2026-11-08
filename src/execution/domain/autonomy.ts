import type { Phase } from "../../workflow-definition/domain/vocabulary.ts";
import type { Gate } from "./gate.ts";
import type { WorkflowSettings } from "./workflow-record.ts";

export type GateDecider = "person-decides" | "engine-may-decide";

export type GateSetting = {
  readonly gate: Gate;
  readonly phase: Phase;
  readonly settings: WorkflowSettings;
};

export const gateDecider = (setting: GateSetting): GateDecider =>
  setting.gate.kind === "stage" &&
  setting.phase === "construction" &&
  setting.settings.constructionAutonomy === "autonomous"
    ? "engine-may-decide"
    : "person-decides";

export type TurnEnding = "may-end-turn" | "carries-on";

export const turnEnding = (settings: WorkflowSettings): TurnEnding =>
  settings.constructionAutonomy === "autonomous" ? "carries-on" : "may-end-turn";
