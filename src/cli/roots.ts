import type { HookGuidanceSource, ToolsGuidanceSource } from "../projection/domain/onboarding-source.ts";
import type { CwdGuidanceSource } from "../projection/domain/cwd-guidance.ts";
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
import type { CapturedHostSources, HostSourcesInput } from "../projection/application/ports/build-sources.ts";
import type { Result } from "../kernel/result.ts";
import type { ReadHostDistribution } from "../packaging/application/ports.ts";
export type { ReadHostDistribution } from "../packaging/application/ports.ts";
import type { FrameworkVersion, KernelRefusal } from "../kernel/values.ts";
import type { YamlParser } from "../kernel/yaml-parser-port.ts";
import type { PackagingRefusal } from "../packaging/domain/artifact.ts";
import type { ReleaseArchives } from "../packaging/domain/release-archives.ts";
export type { ReleaseArchives } from "../packaging/domain/release-archives.ts";
import type { HostDistribution, Payload, Channel } from "../packaging/domain/payload.ts";
import type { DelegateShellFacts } from "../projection/application/ports/delegate-shell.ts";
import type { ConceptMembers, HostProjectionParts } from "../projection/application/ports/host-parts.ts";
import type { CommandSource } from "../projection/application/ports/commands.ts";
import type { PluginProjector } from "../projection/application/ports/plugins.ts";
import type { CapturedHostProjectionRequest, CompiledMethodTarget } from "../projection/application/ports/captured-host.ts";
import type { HostAgentRenderer } from "../projection/application/ports/agents.ts";
import type { HostDocumentRenderer } from "../projection/application/ports/documents.ts";
import type { HostSettingsRenderer, SettingsCapabilities } from "../projection/application/ports/settings.ts";
import type { HostSkillRenderer } from "../projection/application/ports/skills.ts";
import type { CompiledMethodFiles, HostProjection, ProjectionRefusal } from "../projection/domain/projection.ts";
import type { ChannelTokens } from "../projection/domain/template-token.ts";
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
export type { CapturedHostSources, HostSourcesInput } from "../projection/application/ports/build-sources.ts";

export type HostBuildTable = readonly HostModule[];

export type HostBuildRequest = Omit<CapturedHostProjectionRequest,
  "compile" | "core" | "onboarding" | "nativeReplacements"> & {
  readonly channel: Channel;
  readonly core: CoreBuild;
};

export type ProjectHost = (
  request: HostBuildRequest,
) => Promise<Result<HostProjection, readonly (KernelRefusal | ProjectionRefusal)[]>>;

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
  readonly cwdGuidance: CwdGuidanceSource;
  readonly hookGuidance: HookGuidanceSource;
  readonly toolsGuidance: ToolsGuidanceSource;
  readonly core: URL;
  readonly plugins: URL;
  readonly pluginHookTemplates: URL;
};

export type CoreBuildTarget = CompiledMethodTarget;

export type CoreBuild = AuthoredCoreMethod & {
  project(target: CoreBuildTarget): Result<CompiledMethodFiles, KernelRefusal>;
};

export type CoreCommandRequest = {
  readonly core: CoreBuild;
  readonly projectRoot: URL;
  readonly harnessDir: string;
  readonly harnessName: string;
};

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

export type BuildReleaseArchives = (request: ReleaseArchivesRequest) =>
  Promise<Result<ReleaseArchives, readonly (KernelRefusal | ProjectionRefusal | PackagingRefusal | MethodRefusal)[]>>;

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
    request: HostSourcesInput,
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
