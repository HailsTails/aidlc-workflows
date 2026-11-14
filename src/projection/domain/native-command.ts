import { brand, type Brand } from "../../kernel/brand.ts";
import type { FileContent, FileMode } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { projectPath, type KernelRefusal, type NonEmptyArray } from "../../kernel/values.ts";
import type { ScopeName, StageSlug } from "../../workflow-definition/domain/identities.ts";

export type NativeCommandName = Brand<string, "NativeCommandName">;

export type CommandFilePath = Brand<string, "CommandFilePath">;

export const ENTRY_SHORTCUTS = ["aidlc-init", "aidlc-compose"] as const;

export type EntryShortcut = (typeof ENTRY_SHORTCUTS)[number];

export type CommandSubject =
  | { readonly concept: "stage-command"; readonly name: StageSlug }
  | { readonly concept: "scope-command"; readonly name: ScopeName }
  | { readonly concept: "orchestrator-skill"; readonly name: EntryShortcut };

export type NativeCommandFile = {
  readonly name: NativeCommandName;
  readonly within: CommandFilePath;
  readonly content: FileContent;
  readonly mode: FileMode;
};

export type CommandReading =
  | { readonly kind: "rendered"; readonly files: NonEmptyArray<NativeCommandFile> }
  | { readonly kind: "declined" };

const SEGMENT_SEPARATOR = "/";

export const nativeCommandName = (raw: string): Result<NativeCommandName, KernelRefusal> => {
  const portable = projectPath(raw);
  if (!portable.ok) return portable;
  return raw.includes(SEGMENT_SEPARATOR)
    ? refused({ kind: "invalid-path", base: "project", raw })
    : accepted(brand<NativeCommandName>(raw));
};

export const commandFilePath = (raw: string): Result<CommandFilePath, KernelRefusal> => {
  const portable = projectPath(raw);
  return portable.ok ? accepted(brand<CommandFilePath>(raw)) : portable;
};

export interface NativeCommandRoutes {
  readonly prefix: string;
  readonly namespace: string;
  readonly delegates: readonly string[];
  readonly adapterHooks: ReadonlySet<string>;
  trusted(suffix: string): string;
  unresolvable(request: { readonly file: string; readonly text: string }): readonly string[];
}
