import { prepareStageProse, stageDocumentPath, type AuthoredStage, type StageContext } from "../domain/stage-definition.ts";
import type { NativeStageCommandPreparer, NativeStageCommands, StageCommandDraft } from "../domain/native-stage-commands.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { Outcome } from "../domain/model.ts";
import type { ProjectionSetUnit } from "./projection-set.ts";
const stageDrafts = ({ stages, context }: { readonly stages: readonly AuthoredStage[]; readonly context: StageContext }): Outcome<readonly StageCommandDraft[]> => {
  const drafted = stages.map((stage) => prepareStageProse({ stage, context }));
  const findings = drafted.flatMap((draft) => draft.status === "invalid" ? draft.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: drafted.flatMap((draft) => draft.status === "ok" ? [draft.value] : []) };
};
export const prepareStageCommands = ({ sourceRoot, basis, stages, context, preparer }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly stages: readonly AuthoredStage[]; readonly context: StageContext; readonly preparer: NativeStageCommandPreparer }): Outcome<NativeStageCommands | null> => {
  if (context.invocation.startsWith("bun ") || context.preparationStage === "before-host") return { status: "ok", value: null };
  const drafts = stageDrafts({ stages, context });
  return drafts.status === "invalid" ? drafts : preparer.prepare({ sourceRoot, basis, binding: context, documents: drafts.value });
};
export const stageProjectionUnits = ({ stages, context, commands }: { readonly stages: readonly AuthoredStage[]; readonly context: StageContext; readonly commands: NativeStageCommands | null }): readonly ProjectionSetUnit[] => stages.map((stage) => {
  const native = commands?.documents.find((document) => document.path === stageDocumentPath({ stage, context }));
  return { kind: "stage", key: `stage-${stage.slug}`, input: { stage, context: { ...context, ...(native === undefined ? {} : { nativeCommands: native }) } } };
});
