import type { SourcePath } from "../../kernel/values.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { FileSystemError, FolderEntry, TreeReading, ReadFileArgs, ListFolderArgs, ReadTreeArgs }
  from "../../kernel/file-system-port.ts";
import type { ParseYamlArgs, YamlRefusal } from "../../kernel/yaml-parser-port.ts";
import type { PluginId } from "../domain/identities.ts";
import type { Result } from "../../kernel/result.ts";
import type { Contribution } from "../domain/contribution.ts";
import type { CoreContent, Method, PluginSelection } from "../domain/method.ts";
import type { MethodSource } from "../domain/method-source.ts";
import type { AuthoredBody } from "../domain/outline.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { SavedScope } from "../domain/scope.ts";
import type { StagePin } from "../domain/stage-graph.ts";

export type MethodReading<Value> = Promise<Result<Value, readonly MethodRefusal[]>>;

export type PluginBuildTarget = { readonly plugin: PluginId; readonly directory: string };

export type MethodSources = {
  readonly core: CoreContent;
  readonly contributions: readonly Contribution[];
  readonly saved: readonly SavedScope[];
  readonly pins: readonly StagePin[];
  readonly files: readonly MethodSource[];
  readonly plugins: readonly PluginBuildTarget[];
};

export interface MethodSourceReader {
  readAuthored(): MethodReading<MethodSources>;
}

export interface PluginSelectionSource {
  readSelection(): Promise<PluginSelection>;
}

export interface MarkdownOutliner {
  outline(text: string): AuthoredBody;
}

export interface AuthoredTreeReader {
  readFile(readFileArgs: ReadFileArgs): Promise<Result<FileContent, FileSystemError>>;
  listFolder(listFolderArgs: ListFolderArgs): Promise<Result<readonly FolderEntry[], FileSystemError>>;
  readTree(readTreeArgs: ReadTreeArgs): Promise<Result<TreeReading, FileSystemError>>;
}

export interface FrontmatterParser {
  parse(parseYamlArgs: ParseYamlArgs): Result<unknown, YamlRefusal>;
}

export type CapturedSourceFile = {
  readonly within: SourcePath;
  readonly content: FileContent;
};

export type CapturedMethodFiles = {
  readonly stages: readonly CapturedSourceFile[];
  readonly agents: readonly CapturedSourceFile[];
  readonly scopes: readonly CapturedSourceFile[];
  readonly sensors: readonly CapturedSourceFile[];
  readonly rules: readonly CapturedSourceFile[];
  readonly knowledge: readonly CapturedSourceFile[];
};

export type CapturedPluginFiles = {
  readonly directory: string;
  readonly manifest: CapturedSourceFile;
  readonly files: readonly CapturedSourceFile[];
  readonly methodFiles: CapturedMethodFiles;
};

export type AuthoredContent = {
  readonly core: CoreContent;
  readonly files: readonly MethodSource[];
};

export type ContributionReading = {
  readonly contribution: Contribution;
  readonly files: readonly MethodSource[];
};

export interface MethodContentDecoder {
  decodeCore(files: CapturedMethodFiles): MethodReading<AuthoredContent>;
  decodeContribution(capture: CapturedPluginFiles): MethodReading<ContributionReading>;
}

export type AuthoredCoreMethod = {
  readonly method: Method;
  readonly authored: CoreContent;
  readonly sources: readonly MethodSource[];
};

export type AuthoredPluginBuild = {
  readonly method: Method;
  readonly plugins: readonly PluginBuildTarget[];
};
