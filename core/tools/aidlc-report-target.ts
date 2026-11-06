import { workflowIsUnjoined } from "./aidlc-workflow-participation.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { singleStageAttemptFieldIn, singleStageAttemptOpenIn } from "./aidlc-attempt-boundary.ts";
import { spaceRecordRoot } from "./aidlc-locks.ts";
import type { OrchestratorRequest } from "./aidlc-orchestrator-request.ts";
import { type ProjectDirectoryContext, resolveProjectDirectory } from "./aidlc-project-dir.ts";
import {
  getField,
  readAuditShardEvents,
  relativeRecordDirForSelection,
  resolveWorkflowSelection,
  type WorkflowParticipation,
  type WorkflowSelection,
  workflowParticipation,
} from "./aidlc-record-core.ts";
import { isCompiledExecutable } from "./aidlc-runtime-paths.ts";

export interface ReportTargetContext extends Omit<ProjectDirectoryContext, "explicitDir" | "leaf"> {
  sessionId?: string;
}

interface ReportTargetBase {
  kind: "resolved";
  projectDir: string;
  selection: WorkflowSelection;
  participation: WorkflowParticipation;
  unjoined: boolean;
  recordDir: string;
  stage: string;
  unit?: string;
}

export type ReportTarget =
  | (ReportTargetBase & {
    mode: "main";
    stateContent: string;
    stageSource: "explicit" | "current";
    currentStage: string;
    scope: string;
  })
  | (ReportTargetBase & {
    mode: "single";
    stateContent: null;
    stageSource: "explicit";
    scope: string | null;
    workflow: string;
  })
  | { kind: "unavailable"; reason: string };

/** Resolve facts only. Callers retain authority checks; observing a report never joins its work. */
export function resolveReportTarget({ request, context }: {
  request: Extract<OrchestratorRequest, { kind: "report" }>;
  context: ReportTargetContext;
}): ReportTarget {
  try {
    const projectDir = resolveProjectDirectory({
      ...context,
      explicitDir: request.launcher.projectDir,
      environment: context.environment ?? process.env,
      // A native command runs in its own runtime, not this observing hook's install.
      sourceFile: context.sourceFile ?? (context.native === true ? undefined : fileURLToPath(import.meta.url)),
      native: context.native ?? isCompiledExecutable(),
      execPath: context.execPath ?? process.execPath,
    });
    const selection = resolveWorkflowSelection(projectDir, { sessionId: context.sessionId, bind: false });
    const participation = workflowParticipation(projectDir, selection);
    const relativeRecord = relativeRecordDirForSelection(selection);
    const recordDir = relativeRecord === null
      ? spaceRecordRoot(projectDir, selection.space)
      : join(projectDir, relativeRecord);
    const base = {
      kind: "resolved" as const, projectDir, selection, participation, recordDir,
      unjoined: workflowIsUnjoined(selection, participation),
      ...(request.flags.unit === undefined ? {} : { unit: request.flags.unit }),
    };

    if (request.branch === "single") {
      const stage = request.flags.stage;
      if (!stage) return { kind: "unavailable", reason: "A single-stage report requires an explicit stage." };
      const unreadable: string[] = [];
      // Empty intent pins the space's own record; undefined would select work again.
      const events = readAuditShardEvents(projectDir, selection.intent ?? "", selection.space, unreadable, false)
        .sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 :
          a.shardIndex - b.shardIndex || a.pos - b.pos);
      if (unreadable.length > 0) {
        return { kind: "unavailable", reason: "The selected record's isolated-attempt evidence could not be read." };
      }
      if (!singleStageAttemptOpenIn(events, stage)) {
        return { kind: "unavailable", reason: `No open single-stage:${stage} attempt exists in the selected record.` };
      }
      return {
        ...base, mode: "single", stage, stageSource: "explicit", stateContent: null,
        scope: singleStageAttemptFieldIn(events, stage, "Scope"), workflow: `single-stage:${stage}`,
      };
    }

    const stateContent = readFileSync(join(recordDir, "aidlc-state.md"), "utf-8");
    const currentStage = getField(stateContent, "Current Stage");
    if (!currentStage) {
      return { kind: "unavailable", reason: "The selected state has no Current Stage field." };
    }
    const scope = getField(stateContent, "Scope");
    if (!scope) return { kind: "unavailable", reason: "The selected state has no Scope field." };
    const explicitStage = request.flags.stage?.trim();
    return {
      ...base, mode: "main", stateContent, currentStage, scope,
      stage: explicitStage || currentStage, stageSource: explicitStage ? "explicit" : "current",
    };
  } catch (error) {
    return { kind: "unavailable", reason: error instanceof Error ? error.message : String(error) };
  }
}
