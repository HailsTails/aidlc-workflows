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
import type { Result } from "../kernel/result.ts";
import type { KernelRefusal, SourcePath } from "../kernel/values.ts";
import type { YamlParser } from "../kernel/yaml-parser-port.ts";
import type { PackagingRefusal } from "../packaging/domain/artifact.ts";
import type { DistributionLayout, HostDistribution, Payload } from "../packaging/domain/payload.ts";
import type { DelegateShellFacts } from "../projection/application/ports/delegate-shell.ts";
import type { ConceptMembers, HostProjectionParts } from "../projection/application/ports/host-parts.ts";
import type { AuthoredFilePreparer } from "../projection/application/ports/host-sources.ts";
import type { CommandSource } from "../projection/application/ports/commands.ts";
import type { Harness } from "../projection/application/ports/harness.ts";
import type { HostAgentRenderer } from "../projection/application/ports/agents.ts";
import type { HostDocumentRenderer } from "../projection/application/ports/documents.ts";
import type { HostSettingsRenderer, SettingsCapabilities } from "../projection/application/ports/settings.ts";
import type { HostSkillRenderer } from "../projection/application/ports/skills.ts";
import type { AuthoredHostFile } from "../projection/domain/host-surface.ts";
import type { DistributionChannel } from "../projection/domain/projected-file.ts";
import type { CompiledMethodFiles, Projection, ProjectionRefusal } from "../projection/domain/projection.ts";
import type { TokenBindings } from "../projection/domain/template-token.ts";
import type { AgentSlug } from "../workflow-definition/domain/identities.ts";
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

export type HostModule = {
  readonly host: HostIdentity;
  readonly projection: HostProjectionParts;
  readonly distribution: HostDistributionReader;
};

export type { ConceptMembers };

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

export type BuildPayload = (
  request: HostBuildRequest,
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

export type CapturedHostSources = {
  readonly host: HostIdentity;
  readonly files: readonly AuthoredHostFile[];
};

export type ReadHostDistribution = (request: {
  readonly host: HostIdentity;
}) => Result<HostDistribution, readonly (KernelRefusal | ProjectionRefusal)[]>;
export interface PackageBuildRoot {
  readonly settingsCapabilities: SettingsCapabilities;
  readonly projectHost: ProjectHost;
  readonly buildPayload: BuildPayload;
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
}) => PackageBuildRoot;

export interface RuntimeRoot {
  routes(request: {
    readonly hosts: readonly RuntimeHost[];
    readonly calling: RuntimeHost | null;
  }): readonly CommandRoute[];
}
