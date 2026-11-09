import type {
  HostConversationSource,
  HostEventDecoder,
  HostResponseEncoder,
  HumanTurnHistory,
} from "../execution/application/boundary-ports.ts";
import type { HostShell } from "../installation/application/boundary-ports.ts";
import type { FileSystem } from "../kernel/file-system-port.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { ProcessRunner } from "../kernel/process-runner-port.ts";
import type { Result } from "../kernel/result.ts";
import type { KernelRefusal, SourcePath } from "../kernel/values.ts";
import type { YamlParser } from "../kernel/yaml-parser-port.ts";
import type { DistributionLayout, HostDistribution } from "../packaging/domain/payload.ts";
import type {
  AuthoredFilePreparer,
  CommandPlacement,
  CommandSource,
  Harness,
  HostAgentRenderer,
  HostDocumentRenderer,
  HostSettingsRenderer,
  HostSkillRenderer,
  Rendering,
} from "../projection/application/ports.ts";
import type { AuthoredHostFile, AuthoredPlacement, HostData } from "../projection/domain/host-surface.ts";
import type { DistributionChannel, ProjectedFile } from "../projection/domain/projected-file.ts";
import type { OnboardingFills } from "../projection/domain/neutral-surface.ts";
import type { CompiledMethodFiles, ProjectionRefusal } from "../projection/domain/projection.ts";
import type { HostTokenChoices, TokenBindings } from "../projection/domain/template-token.ts";
import type { Method } from "../workflow-definition/domain/method.ts";
import type { Tier } from "../workflow-definition/domain/vocabulary.ts";
import type {
  AuthoredCoreMethod,
  AuthoredPluginBuild,
  MarkdownOutliner,
  MethodReading,
} from "../workflow-definition/application/ports.ts";

export type ExitStatus = 0 | 1 | 2;

export interface CommandRoute {
  readonly verb: readonly string[];
  run(argv: readonly string[]): Promise<ExitStatus>;
}

export type BuildHost = {
  readonly host: HostIdentity;
  readonly harness: Harness;
  readonly layout: DistributionLayout;
};

export type ConceptMembers<Render> = {
  readonly inputs: readonly SourcePath[];
  readonly render: Render;
};

export type HostConceptMembers<Render> = ConceptMembers<Render> & {
  readonly host: HostIdentity;
};

export type HostAgentMembers = HostConceptMembers<HostAgentRenderer>;

export type HostSkillMembers = HostConceptMembers<HostSkillRenderer>;

export type HostSettingsMembers = HostConceptMembers<HostSettingsRenderer>;

export type HostDocumentMembers = HostConceptMembers<HostDocumentRenderer>;

export type HostBuildMembers = {
  readonly host: HostIdentity;
  readonly tokens: HostTokenChoices;
  readonly data: HostData;
  readonly placements: readonly AuthoredPlacement[];
  readonly agents: ConceptMembers<HostAgentRenderer>;
  readonly commands: CommandPlacement;
  readonly skills: ConceptMembers<HostSkillRenderer>;
  readonly settings: ConceptMembers<HostSettingsRenderer>;
  readonly documents: ConceptMembers<HostDocumentRenderer>;
  readonly fills: OnboardingFills;
  readonly distribution?: HostDistributionReader;
};

export type HostDistributionReader = () => Result<HostDistribution, KernelRefusal>;

export type RuntimeHost = {
  readonly host: HostIdentity;
  readonly shell: HostShell;
  readonly conversation: HostConversationSource;
  readonly humanTurns: HumanTurnHistory;
  readonly decoder: HostEventDecoder;
  readonly encoder: HostResponseEncoder;
};

export type Platform = {
  readonly fileSystem: FileSystem;
  readonly processRunner: ProcessRunner;
  readonly yaml: YamlParser;
};

export type BuildSources = {
  readonly core: URL;
  readonly plugins: URL;
};

export type CoreBuildTarget = {
  readonly name: string;
  readonly directory: string;
  readonly memoryRoot: string;
};

export type CoreBuild = AuthoredCoreMethod & {
  project(target: CoreBuildTarget): Result<CompiledMethodFiles, KernelRefusal>;
};

export type CoreCommandRequest = {
  readonly core: CoreBuild;
  readonly projectRoot: URL;
  readonly harnessDir: string;
  readonly harnessName: string;
};

export type HostSourcesRequest = {
  readonly name: string;
  readonly directory: string;
  readonly root: URL;
  readonly copied: readonly string[];
  readonly required: readonly string[];
};

export type HostAgentsRequest = {
  readonly host: HostIdentity;
  readonly method: Method;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly channel: DistributionChannel;
  readonly modelCap: Tier | null;
};

export type ProjectAgents = (request: HostAgentsRequest) => Rendering;

export type HostSkillsRequest = {
  readonly host: HostIdentity;
  readonly projectRoot: URL;
  readonly method: Method;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly commands: CommandSource;
  readonly place: CommandPlacement;
};

export type ProjectSkills = (request: HostSkillsRequest) => Promise<Rendering>;

export type HostSurfaceMembers = {
  readonly host: HostIdentity;
  readonly data: HostData;
  readonly placements: readonly AuthoredPlacement[];
};

export type HostSurfaceRequest = {
  readonly host: HostIdentity;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
};

export type ProjectHostSurface = (request: HostSurfaceRequest) => Rendering;

export type HostSettingsRequest = {
  readonly host: HostIdentity;
  readonly method: Method;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
  readonly entrypoints: readonly SourcePath[];
};

export type ProjectSettings = (request: HostSettingsRequest) => Rendering;

export type HostRuntimeRequest = {
  readonly host: HostIdentity;
  readonly method: Method;
  readonly tokens: TokenBindings;
};

export type ProjectRuntime = (
  request: HostRuntimeRequest,
) => Promise<Result<readonly ProjectedFile[], readonly ProjectionRefusal[]>>;

export type CapturedHostSources = {
  readonly host: HostIdentity;
  readonly files: readonly AuthoredHostFile[];
};

export interface PackageBuildRoot {
  readonly projectSettings: ProjectSettings;
  readonly projectRuntime: ProjectRuntime;
  readonly projectHostSurface: ProjectHostSurface;
  readonly projectSkills: ProjectSkills;
  readonly projectAgents: ProjectAgents;
  loadCore(): MethodReading<CoreBuild>;
  loadPlugins(request: { readonly core: CoreBuild }): MethodReading<AuthoredPluginBuild>;
  prepareCommandSource(request: CoreCommandRequest): Promise<CommandSource>;
  readHostSources(
    request: HostSourcesRequest,
  ): Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>>;
}

export type CreatePackageBuildRoot = (createPackageBuildRootArgs: {
  readonly platform: Platform;
  readonly outliner: MarkdownOutliner;
  readonly sources: BuildSources;
  readonly runnerFrames: URL;
}) => PackageBuildRoot;

export interface RuntimeRoot {
  routes(request: {
    readonly hosts: readonly RuntimeHost[];
    readonly calling: RuntimeHost | null;
  }): readonly CommandRoute[];
}
