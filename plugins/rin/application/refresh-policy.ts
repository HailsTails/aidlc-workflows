import type { WorkflowRefreshPolicy } from "../../../core/tools/aidlc-workflow-refresh-contract.ts";
import { renderRefreshRevalidationNotes } from "../../../core/tools/aidlc-refresh-notes.ts";
import { rinStageRefreshComparison } from "./refresh-contract.ts";
import { rinRefreshEffectNotes } from "./refresh-notes.ts";

export const rinWorkflowRefreshPolicy: WorkflowRefreshPolicy = {
  id: "rin-reviewed-refresh-67-82-96-v1",
  compareStages: rinStageRefreshComparison,
  notes: (args) => renderRefreshRevalidationNotes<string>({ ...args, notes: rinRefreshEffectNotes }),
};
