import type { Stage } from "../../workflow-definition/domain/stage.ts";
import type { QuestionOption } from "./directive.ts";

export const STAGE_GATE_OPTIONS: readonly QuestionOption[] = [
  { label: "Approve", meaning: "The work is right; carry on to the next stage." },
  { label: "Request Changes", meaning: "Say what to change; the stage is revised and asked again." },
  { label: "Stop for now", meaning: "Park the work here; pick it up again whenever you like." },
];

export const stageGateQuestion = (stage: Pick<Stage, "displayName">): string =>
  `${stage.displayName} is ready for your decision. How would you like to go on?`;
