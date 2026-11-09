import type { FileContent } from "../../kernel/file-content.ts";
import type {
  FileSystemError,
  FileWriteError,
  MakeFolderArgs,
  MakeScratchFolderArgs,
  ReadFileArgs,
  ReadTreeArgs,
  RemoveFolderArgs,
  TreeReading,
  WriteFileArgs,
} from "../../kernel/file-system-port.ts";
import type {
  ProcessFailure,
  ProcessOutput,
  RunCurrentRuntimeArgs,
} from "../../kernel/process-runner-port.ts";
import type { Result } from "../../kernel/result.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import type { DistributionId, KernelRefusal, ProjectPath, SourcePath } from "../../kernel/values.ts";
import type { Agent } from "../../workflow-definition/domain/agent.ts";
import type { HookDeclaration } from "../../workflow-definition/domain/hooks.ts";
import type { KnowledgeDocument } from "../../workflow-definition/domain/knowledge.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { Scope } from "../../workflow-definition/domain/scope.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import type { ScopeColumn, StageNode } from "../../workflow-definition/domain/stage-graph.ts";
import type { AuthoredHostFile } from "../domain/host-surface.ts";
import type { CommandReading, CommandSubject, NativeCommandFile } from "../domain/native-command.ts";
import type {
  NeutralDocument,
  NeutralSurface,
  OnboardingFills,
  OnboardingTemplates,
  SessionSkill,
} from "../domain/neutral-surface.ts";
import type { DistributionChannel, ProjectedFile } from "../domain/projected-file.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { HostTokenBindings, TokenBindings } from "../domain/template-token.ts";

export type Rendering = Result<readonly ProjectedFile[], ProjectionRefusal>;

export type AgentRenderingInputs = {
  readonly channel: DistributionChannel;
};

export type HostAgentRenderer = (inputs: AgentRenderingInputs) => Harness["renderAgent"];

export type SkillTableVerb = "stage-table" | "scope-table";

export type SkillTableRenderer = (verb: SkillTableVerb) => Result<string, string>;

export type AuthoredFilePreparer = (file: AuthoredHostFile) => Result<AuthoredHostFile, ProjectionRefusal>;

export type SkillRenderingInputs = {
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly tables: SkillTableRenderer;
};

export type HostSkillRenderer = (
  inputs: SkillRenderingInputs,
) => Pick<Harness, "renderOrchestratorSkill" | "renderSessionSkill">;

export type CopyChannelAllows = {
  readonly dispatcherCommands: readonly string[];
  readonly toolScripts: readonly string[];
};

export interface CopyChannelAllowSource {
  read(): Result<CopyChannelAllows, ProjectionRefusal>;
}

export type SettingsRenderingInputs = {
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly allows: CopyChannelAllows;
  readonly channel: DistributionChannel;
  readonly entrypoints: readonly SourcePath[];
};

export type HostSettingsRenderer = (
  inputs: SettingsRenderingInputs,
) => Pick<Harness, "renderSettings" | "renderHookRegistrations">;

export type DocumentRenderingInputs = {
  readonly fills: OnboardingFills;
  readonly tokens: TokenBindings;
};

export type HostDocumentRenderer = (
  inputs: DocumentRenderingInputs,
) => Pick<Harness, "renderOnboarding" | "placeNeutralDocument">;

export interface Harness {
  readonly tokens: HostTokenBindings;
  renderAgent(request: {
    readonly agent: Agent;
    readonly knowledge: readonly KnowledgeDocument[];
  }): Rendering;
  renderStageCommand(request: { readonly stage: Stage; readonly node: StageNode }): Rendering;
  renderScopeCommand(request: { readonly scope: Scope; readonly column: ScopeColumn }): Rendering;
  renderOrchestratorSkill(request: { readonly method: Method }): Rendering;
  renderSessionSkill(request: { readonly skill: SessionSkill }): Rendering;
  renderSettings(request: { readonly method: Method }): Rendering;
  renderHookRegistrations(request: { readonly hooks: readonly HookDeclaration[] }): Rendering;
  renderOnboarding(request: {
    readonly templates: OnboardingTemplates;
    readonly method: Method;
  }): Rendering;
  renderHostData(): Rendering;
  placeNeutralDocument(request: { readonly document: NeutralDocument }): Rendering;
  placeAuthoredFile(request: { readonly file: AuthoredHostFile }): Rendering;
}

export type HostedHarness = {
  readonly host: HostIdentity;
  readonly harness: Harness;
};

export interface HarnessRegistry {
  find(id: DistributionId): Result<HostedHarness, ProjectionRefusal>;
  all(): readonly HostedHarness[];
}

export interface NeutralSurfaceReader {
  read(): Promise<Result<NeutralSurface, readonly ProjectionRefusal[]>>;
}

export interface SessionSkillTreeReader {
  readTree(readTreeArgs: ReadTreeArgs): Promise<Result<TreeReading, FileSystemError>>;
}

export interface HostFileReader {
  readFile(readFileArgs: ReadFileArgs): Promise<Result<FileContent, FileSystemError>>;
}

export interface LegacyRunnerScratch {
  makeScratchFolder(makeScratchFolderArgs: MakeScratchFolderArgs): Promise<Result<URL, FileWriteError>>;
  makeFolder(makeFolderArgs: MakeFolderArgs): Promise<Result<URL, FileWriteError>>;
  writeFile(writeFileArgs: WriteFileArgs): Promise<Result<URL, FileWriteError>>;
  removeFolder(removeFolderArgs: RemoveFolderArgs): Promise<Result<URL, FileWriteError>>;
}

export interface LegacyRunnerProcess {
  runCurrentRuntime(
    runCurrentRuntimeArgs: RunCurrentRuntimeArgs,
  ): Promise<Result<ProcessOutput, ProcessFailure>>;
}

export interface LegacyRunnerOutputReader {
  readTree(readTreeArgs: ReadTreeArgs): Promise<Result<TreeReading, FileSystemError>>;
}

export interface SessionSkillSource {
  read(): Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>>;
}

export interface CommandSource {
  read(subject: CommandSubject): Result<CommandReading, ProjectionRefusal>;
}

export type CommandPlacement = (file: NativeCommandFile) => Result<ProjectPath, KernelRefusal>;

export interface HostSurfaceReader {
  read(request: {
    readonly host: HostIdentity;
  }): Promise<Result<readonly AuthoredHostFile[], readonly ProjectionRefusal[]>>;
}
