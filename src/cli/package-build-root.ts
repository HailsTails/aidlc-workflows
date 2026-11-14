import { createBuildPackaging, createBuildHostPayload, createHostDistributionReading,
  createReleaseArtifacts, createBuildReleaseArchives, type BuildPackaging } from "../packaging/core-root.ts";
import { channelTokens } from "../packaging/domain/channel-tokens.ts";
import { bindCopiedSource } from "../projection/domain/source-binding.ts";
import { prepareHostSource } from "../projection/application/prepared-host-source.ts";
import { createPluginBuildRoute } from "./adapters/routes/build/plugin-route.ts";
import { createPluginBuilds } from "./adapters/routes/build/plugin-builds.ts";
import { reviewerAgentSet } from "../workflow-definition/domain/method-participation.ts";
import type { ContentHasher } from "../packaging/application/ports.ts";
import type { BuildProjection } from "../projection/application/ports/build-projection.ts";
import type { BuildSourceCapture, CapturedHostSources } from "../projection/application/ports/build-sources.ts";
import { accepted, refused } from "../kernel/result.ts";
import type { KernelRefusal, SourcePath } from "../kernel/values.ts";
import type { Result } from "../kernel/result.ts";
import { createAuthoredMethodLoading } from "../workflow-definition/core-root.ts";
import type { AuthoredPluginBuild, MethodReading } from "../workflow-definition/application/ports.ts";
import type { MethodRefusal } from "../workflow-definition/domain/refusals.ts";
import type { PluginBuildSession } from "../projection/application/ports/plugin-session.ts";
import { captureBuildSources, createCapturedMethodCompiler, createProjectCapturedHost, createPluginAuthoringEnrichment,
  createPluginBuildSession, captureReleaseEntrypoints, createBuildProjection, createHostedMethodProjection }
  from "../projection/core-root.ts";
import type { CoreBuild, CreatePackageBuildRoot,
  HostBuildTable, HostModule, ReadHostDistribution,
  ProjectHost, BuildPayload, BuildPlugins, PackageBuildRoot, ReleaseArchivesRequest, HostBuildRequest } from "./roots.ts";
import type { BuildRoutesRequest, CommandRoute } from "./roots.ts";
import type { PackagingRefusal } from "../packaging/domain/artifact.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";
import type { EnrichPluginAuthoring } from "../projection/application/ports/plugin-authoring.ts";
import { createPackageDistributions, createOutputTrees, createPackagedSourcesFile, buildVersionNotice }
  from "../packaging/core-root.ts";
import { announceBuiltPayload, announceModelCap, createBuildRoute,
  entrypointPreparationDiagnostic, methodPreparationDiagnostic, type PreparationDiagnostic } from "./adapters/routes/build/build-route.ts";
import { HOST_BUILD_REFUSALS } from "./host-table.ts";
import type { BuildMode, ModelCapReading } from "../projection/domain/model-cap.ts";
import type { DistributionBuildFailure, DistributionPayloads } from "../packaging/application/ports.ts";
import type { Terminal } from "../kernel/terminal-port.ts";


const memberFor = (hosts: HostBuildTable, host: HostIdentity): HostModule | undefined =>
  hosts.find((candidate) => candidate.host.distribution === host.distribution);

const hostProjector = (ports: {
  readonly projection: BuildProjection; readonly capture: BuildSourceCapture["captureFullHost"];
  readonly hosts: HostBuildTable; readonly readDistribution: ReadHostDistribution;
}): ProjectHost => {
  const project = createProjectCapturedHost({
    members: ports.hosts.map(({ host, projection }) => ({ host, projection })),
    capture: ports.capture, assemble: ports.projection.assembleHarness, hosted: createHostedMethodProjection,
  });
  return async (request) => {
    const distribution = ports.readDistribution({ host: request.host });
    if (!distribution.ok) return distribution;
    return project({ ...request, core: { method: request.core.method, sources: request.core.sources },
      compile: request.core.project });
  };
};

const payloadBuilder = (ports: {
  readonly projectHost: ProjectHost; readonly hosts: HostBuildTable; readonly packaging: BuildPackaging;
  readonly readDistribution: ReadHostDistribution; readonly hasher: ContentHasher;
  readonly projection: Pick<BuildProjection, "delegateShellFacts">;
  readonly enrich: EnrichPluginAuthoring;
}): BuildPayload => {
  const build = createBuildHostPayload({
    members: ports.hosts.map((module) => ({ host: module.host,
      data: () => module.projection.renderData({ delegateShellFacts: ports.projection.delegateShellFacts }) })),
    distribution: ports.readDistribution, hasher: ports.hasher, packaging: ports.packaging,
  });
  return (request) => build({ host: request.host, project: () => ports.projectHost(request),
    enrich: (projection) => ports.enrich({ projection, method: request.core.method, directory: request.host.directory }),
    channel: request.channel, copy: request.copy });
};

const releasePreparation = async (ports: {
  readonly request: Parameters<CreatePackageBuildRoot>[0]; readonly root: PackageBuildRoot;
  readonly projection: BuildProjection; readonly release: ReleaseArchivesRequest;
}) => {
  const loaded = await ports.root.loadCore();
  if (!loaded.ok) return loaded;
  const plugins = await ports.root.loadPlugins({ core: loaded.value });
  if (!plugins.ok) return plugins;
  const entrypoints = await captureReleaseEntrypoints({ core: ports.request.sources.core,
    reader: ports.request.platform.fileSystem });
  if (!entrypoints.ok) return entrypoints;
  return accepted({
    payloadsFor: async (host: HostIdentity): Promise<Result<DistributionPayloads,
      readonly (KernelRefusal | ProjectionRefusal | PackagingRefusal)[]>> => {
      const members = ports.request.hosts.find((candidate) => candidate.host === host);
      if (!members) return refused([{ kind: "unknown-harness", harness: host.distribution }]);
      const captured = await ports.root.readHostSources({ name: host.distribution, directory: host.directory,
        root: new URL(`../harness/${host.distribution}/`, ports.request.sources.core), copied: [], required: [] });
      if (!captured.ok) return captured;
      const prepared: PreparedDistributions = { core: loaded.value, plugins: plugins.value,
        entrypoints: entrypoints.value, hosts: [captured.value] };
      return accepted(async (hostPayloadRequest) => {
        const request = hostBuildRequest({ prepared, hosts: [members], projection: ports.projection,
          modelCap: ports.release.modelCap }, hostPayloadRequest);
        return request.ok ? ports.root.buildPayload(request.value) : request;
      });
    },
  });
};

const releaseArchives = (ports: {
  readonly request: Parameters<CreatePackageBuildRoot>[0]; readonly root: () => PackageBuildRoot;
  readonly packaging: BuildPackaging; readonly projection: BuildProjection;
}) => async (release: ReleaseArchivesRequest) => createBuildReleaseArchives<KernelRefusal | ProjectionRefusal | MethodRefusal>({
  version: ports.packaging.version, root: new URL("../", ports.request.sources.core),
  hosts: ports.request.hosts.map((members) => members.host),
  prepare: () => releasePreparation({ ...ports, root: ports.root(), release }),
  artifacts: () => createReleaseArtifacts({ folder: release.archives,
    fileSystem: ports.request.platform.fileSystem, hasher: ports.request.platform.digester }),
})(release);

const hostRoutes = (request: Parameters<CreatePackageBuildRoot>[0], projection: BuildProjection) =>
  request.hosts.flatMap((module) => module.routes({ terminal: request.platform.terminal,
    settings: projection.settingsCapabilities, copyTokens: channelTokens({ channel: "copy",
      directory: module.host.directory, prefix: projection.nativeCommands.prefix,
      namespace: projection.nativeCommands.namespace }) }));

type PreparedDistributions = {
  readonly core: CoreBuild;
  readonly plugins: AuthoredPluginBuild;
  readonly hosts: readonly CapturedHostSources[];
  readonly entrypoints: readonly SourcePath[];
};

const prepareDistributionHosts = (ports: {
  readonly root: PackageBuildRoot; readonly request: Parameters<CreatePackageBuildRoot>[0];
}, hosts: readonly HostIdentity[]): Promise<Result<readonly CapturedHostSources[], readonly DistributionBuildFailure[]>> =>
  hosts.reduce<Promise<Result<readonly CapturedHostSources[], readonly DistributionBuildFailure[]>>>(async (pending, host) => {
    const previous = await pending;
    if (!previous.ok) return previous;
    const distribution = ports.root.readHostDistribution({ host });
    if (!distribution.ok) throw new Error(JSON.stringify(distribution.refusal));
    const source = await ports.root.readHostSources({ name: host.distribution, directory: host.directory,
      root: new URL(`../harness/${encodeURIComponent(host.distribution)}/`, ports.request.sources.core), copied: [], required: [] });
    return source.ok ? accepted([...previous.value, source.value]) : source;
  }, Promise.resolve(accepted([])));

const prepareDistributions = async (ports: {
  readonly root: PackageBuildRoot; readonly request: Parameters<CreatePackageBuildRoot>[0];
  readonly packaging: BuildPackaging;
}, hosts: readonly HostIdentity[]): Promise<Result<PreparedDistributions,
  readonly (DistributionBuildFailure | PreparationDiagnostic)[]>> => {
  if (!ports.packaging.version.ok) return refused([ports.packaging.version.refusal]);
  const core = await ports.root.loadCore();
  if (!core.ok) return refused([methodPreparationDiagnostic({ method: "core", refusals: core.refusal })]);
  const plugins = await ports.root.loadPlugins({ core: core.value });
  if (!plugins.ok) return refused([methodPreparationDiagnostic({ method: "plugin", refusals: plugins.refusal })]);
  const captured = await prepareDistributionHosts(ports, hosts);
  if (!captured.ok) return captured;
  const entrypoints = await captureReleaseEntrypoints({ core: ports.request.sources.core,
    reader: ports.request.platform.fileSystem });
  if (!entrypoints.ok) return refused([entrypointPreparationDiagnostic(entrypoints.refusal)]);
  return accepted({ core: core.value, plugins: plugins.value, hosts: captured.value, entrypoints: entrypoints.value });
};

const hostBuildRequest = (ports: {
  readonly prepared: PreparedDistributions; readonly hosts: HostBuildTable;
  readonly projection: BuildProjection; readonly modelCap: HostBuildRequest["modelCap"];
}, hostPayloadRequest: Parameters<DistributionPayloads>[0]) => {
  const members = memberFor(ports.hosts, hostPayloadRequest.host);
  const captured = ports.prepared.hosts.find((host) => host.host.distribution === hostPayloadRequest.host.distribution);
  if (!members || !captured) return refused([{ kind: "unknown-harness" as const, harness: hostPayloadRequest.host.distribution }]);
  const tokens = { ...members.projection.tokens, ["HARNESS_DIR"]: members.host.directory,
    ...channelTokens({ channel: hostPayloadRequest.channel, directory: members.host.directory,
      prefix: ports.projection.nativeCommands.prefix, namespace: ports.projection.nativeCommands.namespace }) };
  return accepted({ ...hostPayloadRequest, host: captured.host, core: ports.prepared.core, files: captured.files,
    prepare: (file: CapturedHostSources["files"][number]) => prepareHostSource({ host: captured.host, file,
      steps: [(content) => bindCopiedSource({ source: file.source, content, tokens })] }),
    tokens, modelCap: ports.modelCap, entrypoints: ports.prepared.entrypoints,
    reviewerAgents: reviewerAgentSet(ports.prepared.plugins.method) });
};

const distributionBuild = (ports: {
  readonly root: PackageBuildRoot; readonly request: Parameters<CreatePackageBuildRoot>[0];
  readonly packaging: BuildPackaging; readonly projection: BuildProjection;
  readonly reading: ModelCapReading; readonly mode: BuildMode;
  readonly buildPlugins: BuildPlugins;
}) => {
  let preparation: Promise<Result<PreparedDistributions,
  readonly (DistributionBuildFailure | PreparationDiagnostic)[]>> | undefined;
  let prepared: PreparedDistributions | undefined;
  const unavailable = () => refused([{ kind: "render-failed" as const, concept: "host-data" as const,
    name: "package-build", reason: "Prepare the build sources before projecting distributions." }]);
  const repository = new URL("../", ports.request.sources.core);
  return createPackageDistributions<PreparationDiagnostic>({
    prepare: async ({ hosts }) => {
      const captured = await (preparation ??= prepareDistributions(ports, hosts));
      if (!captured.ok) return captured;
      prepared = captured.value;
      return accepted(undefined);
    },
    payloads: async (hostPayloadRequest) => {
      if (!prepared) return unavailable();
      const request = hostBuildRequest({ ...ports, prepared, hosts: ports.request.hosts, modelCap: ports.reading.cap }, hostPayloadRequest);
      return request.ok ? ports.root.buildPayload(request.value) : request;
    },
    plugins: {
      get directories() { return prepared?.plugins.plugins.map((plugin) => plugin.directory) ?? []; },
      build: (request) => {
        if (!prepared) return unavailable();
        const built = ports.buildPlugins({ ...request, plugins: prepared.plugins.plugins });
        return built.ok ? accepted(undefined) : built;
      },
    },
    outputs: createOutputTrees({ root: repository, scratchParent: new URL(".cache/package-check/", repository),
      fileSystem: ports.request.platform.fileSystem,
      written: (hostPayload) => {
        if (ports.mode === "build") announceBuiltPayload({ terminal: ports.request.platform.terminal, hostPayload });
      } }),
    sources: createPackagedSourcesFile({ repository, record: new URL("dist/.package-sources.json", repository),
      fileSystem: ports.request.platform.fileSystem, hasher: ports.request.platform.digester }),
  });
};

const packageRoutes = ({ root, request, projection, packaging, pluginsFor, buildPlugins, plugins }: {
  readonly root: PackageBuildRoot; readonly request: Parameters<CreatePackageBuildRoot>[0];
  readonly projection: BuildProjection; readonly packaging: BuildPackaging;
  readonly pluginsFor: (terminal: Terminal) => BuildPlugins;
  readonly buildPlugins: BuildPlugins; readonly plugins: PluginBuildSession;
}, { resolveModelCap }: BuildRoutesRequest): readonly CommandRoute[] => {
  const announceVersion = () => {
    if (!packaging.version.ok) {
      const failure = packaging.version.refusal;
      throw new Error(failure.kind === "version-unstampable" ? failure.reason : JSON.stringify(failure));
    }
    const notice = buildVersionNotice(packaging.version.value);
    if (notice) request.platform.terminal.writeError(notice);
  };

      const plugin = createPluginBuildRoute({ root, hosts: request.hosts.map((module) => module.host),
      terminal: request.platform.terminal, workingDirectory: request.workingDirectory,
      emit: (plugin) => {
        const emitted = plugins.project({ ...plugin, boundary: plugin.output });
        return emitted.ok ? accepted(undefined) : refused(emitted.refusal
          .map((failure) => "reason" in failure ? failure.reason : JSON.stringify(failure)).join("\n"));
      } });
      return [{ ...plugin, run: async (argv) => {
        announceModelCap({ terminal: request.platform.terminal,
          reading: resolveModelCap(argv.includes("--check") ? "check" : "build") });
        announceVersion();
        return plugin.run(argv);
      } }, ...hostRoutes(request, projection), createBuildRoute({
        hosts: request.hosts.map((module) => module.host), refusals: HOST_BUILD_REFUSALS,
        terminal: request.platform.terminal,
        distributions: (mode) => {
          const reading = resolveModelCap(mode);
          announceModelCap({ terminal: request.platform.terminal, reading });
          announceVersion();
          return distributionBuild({ root, request, projection, packaging, reading, mode,
            buildPlugins: mode === "check" ? pluginsFor({ ...request.platform.terminal, write: () => {} }) : buildPlugins });
        },
      })];

};

export const createPackageBuildRoot: CreatePackageBuildRoot = (request) => {
  const loading = createAuthoredMethodLoading({ reader: request.platform.fileSystem,
    parser: request.platform.yaml, outliner: request.outliner });
  const projection = createBuildProjection({ hostFiles: request.platform.fileSystem, sessionFiles: request.platform.fileSystem,
    plugins: request.plugins,
    runnerProcess: request.platform.processRunner, runnerScratch: request.platform.fileSystem,
    runnerFrames: request.runnerFrames, runnerChild: new URL("./legacy-runner-child.ts", import.meta.url) });
  const sourceCapture = captureBuildSources({ projection, core: request.sources.core, hosts: request.hosts });
  const readDistribution = createHostDistributionReading({ members: request.hosts.map((module) => ({
    host: module.host, read: () => module.distribution({ delegateShellFacts: projection.delegateShellFacts }),
  })) });
  const enrich = createPluginAuthoringEnrichment({
    templates: { reader: request.platform.fileSystem, folder: request.sources.pluginHookTemplates },
    targets: request.hosts.map((module) => ({ host: module.host, read: () => {
      const distribution = readDistribution({ host: module.host });
      return distribution.ok ? accepted(distribution.value.plugin) : distribution;
    } })),
  });
  const packaging = createBuildPackaging({ routes: projection.nativeCommands, historyReader: request.platform.fileSystem,
    copyEraSource: new URL("../scripts/copy-era-files.json", request.sources.core) });
  let core: MethodReading<CoreBuild> | undefined;
  const plugins = createPluginBuildSession({ sources: request.sources.plugins, projector: projection.plugins,
    loadMethod: ({ core: loaded }) => loading.loadPlugins({ core: loaded, pluginsRoot: request.sources.plugins }),
    readTarget: ({ host }) => {
      const distribution = readDistribution({ host });
      return distribution.ok ? accepted(distribution.value.plugin) : distribution;
    } });
  const loadCore = async (): MethodReading<CoreBuild> => {
    const loaded = await loading.loadCore(request.sources.core);
    return loaded.ok ? accepted({ ...loaded.value,
      project: createCapturedMethodCompiler({ method: loaded.value.method,
        serializeMethod: projection.serializeMethod }) }) : loaded;
  };
  const projectHost = hostProjector({ projection, hosts: request.hosts, readDistribution,
    capture: sourceCapture.captureFullHost });
  const pluginsFor = (terminal: Terminal): BuildPlugins => (build) => {
    const captured = plugins.forBuild();
    return captured.ok ? createPluginBuilds({ terminal, ...captured.value })(build) : captured;
  };
  const buildPlugins = pluginsFor(request.platform.terminal);
  const root: PackageBuildRoot = {
    settingsCapabilities: projection.settingsCapabilities, readHostDistribution: readDistribution,
    projectHost,
    buildPlugins,
    buildReleaseArchives: releaseArchives({ request, root: () => root, packaging, projection }),
    buildRoutes: (build) => packageRoutes({ root, request, projection, packaging, pluginsFor, buildPlugins, plugins }, build),
    buildPayload: payloadBuilder({ projectHost, hosts: request.hosts, packaging, readDistribution, projection,
      hasher: request.platform.digester, enrich }),
    loadCore: () => core ??= loadCore(),
    loadPlugins: plugins.load,
    prepareCommandSource: ({ core: loaded, ...command }) => projection.prepareCommandSource({ ...command,
      method: loaded.method, sources: loaded.sources }),
    readHostSources: sourceCapture.readHostSources,
  };
  return root;
};
