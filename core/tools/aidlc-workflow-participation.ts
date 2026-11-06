// Pure interpretation of observed selection and participation, independent of guard policy.
import type { WorkflowParticipation, WorkflowSelection } from "./aidlc-record-core.ts";

export function workflowIsUnjoined(selection: WorkflowSelection, participation: WorkflowParticipation): boolean {
  return (selection.intent === null && selection.binding?.source === "unjoined") ||
    (selection.intent !== null && participation !== "participant");
}
