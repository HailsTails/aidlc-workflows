import type {
  HostConversationSource,
  HostEventDecoder,
  HostResponseEncoder,
  HumanTurnHistory,
} from "../execution/application/boundary-ports.ts";
import type { HostShell } from "../installation/application/boundary-ports.ts";
import type { ContentDigester } from "../kernel/content-digester-port.ts";
import type { FileSystem } from "../kernel/file-system-port.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { ProcessRunner } from "../kernel/process-runner-port.ts";
import type { Terminal } from "../kernel/terminal-port.ts";
import type { ResolveModelCap } from "../projection/domain/model-cap.ts";
import type { CapturedHostSources, HostSourcesRequest } from "../projection/application/ports/build-sources.ts";
import type { Result } from "../kernel/result.ts";
import type { FrameworkVersion, KernelRefusal, SourcePath } from "../kernel/values.ts";
import type { YamlParser } from "../kernel/yaml-parser-port.ts";
import type { PackagingRefusal, ReleaseArtifact } from "../packaging/domain/artifact.ts";
import type { DistributionLayout, HostDistribution, Payload } from "../packaging/domain/payload.ts";
import type { DelegateShellFacts } from "../projection/application/ports/delegate-shell.ts";
import type { ConceptMembers, HostProjectionParts } from "../projection/application/ports/host-parts.ts";
import type { AuthoredFilePreparer } from "../projection/application/ports/host-sources.ts";
import type { CommandSource } from "../projection/application/ports/commands.ts";
import type { PluginProjector } from "../projection/application/ports/plugins.ts";
import type { Harness } from "../projection/application/ports/harness.ts";
import type { HostAgentRenderer } from "../projection/application/ports/agents.ts";
import type { HostDocumentRenderer } from "../projection/application/ports/documents.ts";
import type { HostSettingsRenderer, SettingsCapabilities } from "../projection/application/ports/settings.ts";
import type { HostSkillRenderer } from "../projection/application/ports/skills.ts";
import type { AuthoredHostFile } from "../projection/domain/host-surface.ts";
import type { DistributionChannel } from "../projection/domain/projected-file.ts";
import type { CompiledMethodFiles, Projection, ProjectionRefusal } from "../projection/domain/projection.ts";
import type { ChannelTokens, TokenBindings } from "../projection/domain/template-token.ts";
import type { AgentSlug } from "../workflow-definition/domain/identities.ts";
import type { MethodRefusal } from "../workflow-definition/domain/refusals.ts";
import type { Tier } from "../workflow-definition/domain/vocabulary.ts";
import type {
  AuthoredCoreMethod,
  AuthoredPluginBuild,
  MarkdownOutliner,
  MethodReading,
  PluginBuildTarget,
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

export type HostConceptMembers<Render> = ConceptMembers<Render> & {
  readonly host: HostIdentity;
};

export type HostAgentMembers = HostConceptMembers<HostAgentRenderer>;

export type HostSkillMembers = HostConceptMembers<HostSkillRenderer>;

export type HostSettingsMembers = HostConceptMembers<HostSettingsRenderer>;

export type HostDocumentMembers = HostConceptMembers<HostDocumentRenderer>;

export type HostDistributionInputs = {
  readonly delegateShellFacts: DelegateShellFacts;
};

export type HostDistributionReader = (inputs: HostDistributionInputs) => Result<HostDistribution, KernelRefusal>;

export type HostRouteBindings = {
  readonly copyTokens: ChannelTokens;
  readonly terminal: Terminal;
  readonly settings: SettingsCapabilities;
};

export type HostRoutes = (bindings: HostRouteBindings) => readonly CommandRoute[];

export type HostModule = {
  readonly host: HostIdentity;
  readonly projection: HostProjectionParts;
  readonly distribution: HostDistributionReader;
  readonly routes: HostRoutes;
};

export type { ConceptMembers };
export type { CapturedHostSources, HostSourcesRequest } from "../projection/application/ports/build-sources.ts";

export type HostBuildTable = readonly HostModule[];

export type HostBuildRequest = {
  readonly host: HostIdentity;
  readonly core: CoreBuild;
  readonly files: readonly AuthoredHostFile[];
  readonly prepare: AuthoredFilePreparer;
  readonly tokens: TokenBindings;
  readonly channel: DistributionChannel;
  readonly modelCap: Tier | null;
  readonly entrypoints: readonly SourcePath[];
  readonly projectRoot: URL;
  readonly reviewerAgents: ReadonlySet<AgentSlug>;
};

export type HostBuild = {
  readonly host: BuildHost;
  readonly projection: Projection;
};

export type ProjectHost = (
  request: HostBuildRequest,
) => Promise<Result<HostBuild, readonly (KernelRefusal | ProjectionRefusal)[]>>;

export type PayloadBuildRequest = HostBuildRequest & {
  readonly copy: Payload | null;
};

export type BuildPayload = (
  request: PayloadBuildRequest,
) => Promise<Result<Payload, readonly (KernelRefusal | ProjectionRefusal | PackagingRefusal)[]>>;

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
  readonly digester: ContentDigester;
  readonly terminal: Terminal;
};

export type BuildSources = {
  readonly core: URL;
  readonly plugins: URL;
  readonly pluginHookTemplates: URL;
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

export type ReadHostDistribution = (request: {
  readonly host: HostIdentity;
}) => Result<HostDistribution, readonly (KernelRefusal | ProjectionRefusal)[]>;
export type PluginsBuildRequest = {
  readonly plugins: readonly PluginBuildTarget[];
  readonly hosts: readonly HostIdentity[];
  readonly output: URL;
  readonly boundary: URL;
};

export type PluginsBuilt = {
  readonly emitted: readonly URL[];
  readonly catalogues: readonly string[];
};

export type BuildPlugins = (
  request: PluginsBuildRequest,
) => Result<PluginsBuilt, readonly (KernelRefusal | ProjectionRefusal)[]>;

export type BuildRoutesRequest = {
  readonly resolveModelCap: ResolveModelCap;
};

export type BuildRoutes = (request: BuildRoutesRequest) => readonly CommandRoute[];
export type ReleaseArchivesRequest = {
  readonly archives: URL;
  readonly pluginTrees: URL;
  readonly names: { readonly runtime: string; readonly copyRuntime: string };
  readonly stampedAs: FrameworkVersion;
  readonly modelCap: Tier | null;
};

export type ReleaseArchives = {
  readonly runtime: ReleaseArtifact;
  readonly copyRuntime: ReleaseArtifact;
};

export type BuildReleaseArchives = (
  request: ReleaseArchivesRequest,
) => Promise<
  Result<ReleaseArchives, readonly (KernelRefusal | ProjectionRefusal | PackagingRefusal | MethodRefusal)[]>
>;

export interface PackageBuildRoot {
  readonly settingsCapabilities: SettingsCapabilities;
  readonly projectHost: ProjectHost;
  readonly buildPayload: BuildPayload;
  readonly buildPlugins: BuildPlugins;
  readonly buildRoutes: BuildRoutes;
  readonly buildReleaseArchives: BuildReleaseArchives;
  readonly readHostDistribution: ReadHostDistribution;
  loadCore(): MethodReading<CoreBuild>;
  loadPlugins(request: { readonly core: CoreBuild }): MethodReading<AuthoredPluginBuild>;
  prepareCommandSource(request: CoreCommandRequest): Promise<CommandSource>;
  readHostSources(
    request: HostSourcesRequest,
  ): Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>>;
}

export type CreatePackageBuildRoot = (createPackageBuildRootArgs: {
  readonly hosts: HostBuildTable;
  readonly platform: Platform;
  readonly outliner: MarkdownOutliner;
  readonly sources: BuildSources;
  readonly runnerFrames: URL;
  readonly workingDirectory: URL;
  readonly plugins: PluginProjector;
}) => PackageBuildRoot;

export interface RuntimeRoot {
  routes(request: {
    readonly hosts: readonly RuntimeHost[];
    readonly calling: RuntimeHost | null;
  }): readonly CommandRoute[];
}
