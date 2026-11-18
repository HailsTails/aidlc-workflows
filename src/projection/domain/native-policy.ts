import { brand, type Brand } from "../../kernel/brand.ts";
import type { FileMode } from "../../kernel/file-content.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import type { ProjectedFile, ProjectionSourceOrigin } from "./projected-file.ts";
import { accepted, type Result } from "../../kernel/result.ts";

export type NativePolicyPrompt = Brand<Readonly<{
  readonly kind: "native-policy";
  readonly lines: readonly string[];
  readonly obligation: string;
}>, "NativePolicyPrompt">;
export type PromptLines = readonly string[] | NativePolicyPrompt;

export type NativePolicyAdmission = Brand<Readonly<{
  readonly path: ProjectPath; readonly mode: FileMode;
  readonly text: string; readonly obligation: string;
}>, "NativePolicyAdmission">;

export const promptLines = (prompt: PromptLines): readonly string[] => "kind" in prompt ? prompt.lines : prompt;



export const serializeNativePolicy = <Failure>(request: {
  readonly prompt: PromptLines;
  readonly serialize: (lines: readonly string[]) => Result<
    Omit<ProjectedFile, "origin"> & { readonly origin: ProjectionSourceOrigin }, Failure>;
}): Result<ProjectedFile, Failure> => {
  const serialized = request.serialize(promptLines(request.prompt));
  if (!serialized.ok || !("kind" in request.prompt)) return serialized;
  const file = serialized.value;
  return accepted({ ...file, origin: { kind: "native-policy", source: file.origin,
    admission: brand<NativePolicyAdmission>(Object.freeze({ path: file.path, mode: file.mode,
      text: file.content.kind === "text" ? file.content.text
        : new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.content.bytes),
      obligation: request.prompt.obligation })),
  } });
};

export const nativePolicyObligation = (file: ProjectedFile): string | undefined => {
  if (file.origin.kind !== "native-policy") return undefined;
  const admitted = file.origin.admission;
  const text = file.content.kind === "text" ? file.content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.content.bytes);
  return file.path === admitted.path && file.mode === admitted.mode && text === admitted.text
    ? admitted.obligation : undefined;
};
