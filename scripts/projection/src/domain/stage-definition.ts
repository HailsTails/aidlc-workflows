import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { NativeResource } from "./native-rendering.ts";
import type { CompiledWorkflowSource } from "./workflow-compilation.ts";
import { renderWorkflowProse, type WorkflowProseContext } from "./workflow-prose.ts";
import { bindWorkflowSourceInputs } from "./workflow-source-inputs.ts";
import { finding, sourceKey, type Outcome } from "./model.ts";
import type { StageCommandDraft, PreparedStageCommand } from "./native-stage-commands.ts";
export type StagePhase = "initialization" | "ideation" | "inception" | "construction" | "operation";
export type AuthoredStage = { readonly origin: SourceOrigin; readonly slug: string; readonly phase: StagePhase; readonly markdown: string };
export type StageSources = { readonly stages: readonly AuthoredStage[]; readonly inputs: readonly SourceContentDigest[] };
export type StageContext = WorkflowProseContext & { readonly authoring?: readonly SourceOrigin[]; readonly nativeCommands?: PreparedStageCommand };
export type StageProjection = { readonly origin: SourceOrigin; readonly authoring: readonly SourceOrigin[]; readonly slug: string; readonly phase: StagePhase; readonly harness: WorkflowProseContext["harness"]; readonly resources: readonly NativeResource[] };
export const bindStageInputs = ({ sources, workflow }: { readonly sources: StageSources; readonly workflow: CompiledWorkflowSource }): Outcome<StageSources> => {
  const bound = bindWorkflowSourceInputs({ inputs: sources.inputs, workflow, directory: "core/aidlc-common/stages" });
  return bound.status === "invalid" ? bound : { status: "ok", value: sources };
};
export const stageDocumentPath = ({ stage, context }: { readonly stage: AuthoredStage; readonly context: WorkflowProseContext }): string => `${context.directory}/aidlc-common/stages/${stage.phase}/${stage.slug}.md`;
export const prepareStageProse = ({ stage, context }: { readonly stage: AuthoredStage; readonly context: WorkflowProseContext }): Outcome<StageCommandDraft> => {
  const path = stageDocumentPath({ stage, context });
  const projected = renderWorkflowProse({ markdown: stage.markdown, context, subject: path });
  return projected.status === "invalid" ? projected : { status: "ok", value: { path, source: projected.value } };
};
export const renderStageDefinition = ({ stage, context }: { readonly stage: AuthoredStage; readonly context: StageContext }): Outcome<StageProjection> => {
  const draft = prepareStageProse({ stage, context });
  if (draft.status === "invalid") return draft;
  const native = context.nativeCommands;
  if (!context.invocation.startsWith("bun ") && context.preparationStage !== "before-host" && native === undefined) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: stage.origin.path, detail: "native stage emission requires source-owned command preparation bound to this prose and path" })] };
  if (native !== undefined && (context.invocation.startsWith("bun ") || native.path !== draft.value.path || native.source !== draft.value.source || native.origins.length === 0 || native.origins.some((origin) => sourceKey(origin.source) !== sourceKey(stage.origin.source) || origin.pin !== stage.origin.pin))) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: stage.origin.path, detail: "native stage commands must match the native delivery, exact authored prose/path and source basis" })] };
  const origins = [...(context.authoring ?? []), ...(native?.origins ?? [])];
  const authoring = origins.filter((origin, index) => origins.findIndex((candidate) => candidate.path === origin.path && candidate.pin === origin.pin && sourceKey(candidate.source) === sourceKey(origin.source)) === index);
  return { status: "ok", value: { origin: stage.origin, authoring, slug: stage.slug, phase: stage.phase, harness: context.harness, resources: [{ kind: "file", path: draft.value.path, body: native?.text ?? draft.value.source }] } };
};
