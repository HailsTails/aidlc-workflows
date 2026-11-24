import { brand, type Brand } from "../../kernel/brand.ts";
import type { FileMode } from "../../kernel/file-content.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ProjectedFile, ProjectionSourceOrigin } from "./projected-file.ts";

export type RootHistorySnapshot = Readonly<{
  readonly path: ProjectPath; readonly mode: FileMode; readonly text: string; readonly copyAuthoring: string;
}>;
export type RootHistory = Brand<RootHistorySnapshot, "RootHistory">;
export type RootSerialization = Omit<ProjectedFile, "origin" | "content"> & {
  readonly origin: ProjectionSourceOrigin; readonly content: { readonly kind: "text"; readonly text: string };
};

export const serializeRootHistory = <Failure>(request: {
  readonly serialize: (view: "current" | "copy-authoring") => Result<RootSerialization, Failure>;
  readonly mismatch: Failure;
}): Result<ProjectedFile, Failure> => {
  const current = request.serialize("current");
  if (!current.ok) return current;
  const historical = request.serialize("copy-authoring");
  if (!historical.ok) return historical;
  if (current.value.path !== historical.value.path || current.value.mode !== historical.value.mode) return refused(request.mismatch);
  const file = current.value;
  return accepted({ ...file, origin: { kind: "root-history", source: file.origin,
    history: brand<RootHistory>(Object.freeze({ path: file.path, mode: file.mode,
      text: file.content.text, copyAuthoring: historical.value.content.text })) } });
};

export const rootHistoryContent = (file: ProjectedFile): string | undefined => {
  if (file.origin.kind !== "root-history" || file.content.kind !== "text") return undefined;
  const history = file.origin.history;
  return history.path === file.path && history.mode === file.mode && history.text === file.content.text
    ? history.copyAuthoring : undefined;
};
