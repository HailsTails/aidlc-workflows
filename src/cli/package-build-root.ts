import { createBuildPackaging } from "../packaging/core-root.ts";
import type { VersionStamp } from "../projection/application/ports.ts";
import type { SharedRuntime } from "../projection/domain/neutral-surface.ts";
import type { ProjectRuntime } from "./roots.ts";
import type { SessionSkill } from "../projection/domain/neutral-surface.ts";
import type { BuildProjection } from "../projection/application/ports.ts";
import { hostAgentMembers, hostSkillMembers, hostSkillInputs, hostSurfaceMembers,
  hostSettingsInputs, hostSettingsMembers } from "./host-table.ts";
import { accepted, refused } from "../kernel/result.ts";
import { distributionId, projectPath, sourcePath, type KernelRefusal } from "../kernel/values.ts";
import type { Result } from "../kernel/result.ts";
import { createAuthoredMethodLoading } from "../workflow-definition/core-root.ts";
import type { AuthoredCoreMethod, MethodReading } from "../workflow-definition/application/ports.ts";
import { createBuildProjection } from "../projection/core-root.ts";
import type { CompiledMethodFiles } from "../projection/domain/projection.ts";
import type { CoreBuild, CoreBuildTarget, CreatePackageBuildRoot,
  CapturedHostSources, HostSourcesRequest } from "./roots.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";

const projectFor = (request: { readonly authored: AuthoredCoreMethod; readonly target: CoreBuildTarget },
  serializeMethod: BuildProjection["serializeMethod"]):
    Result<CompiledMethodFiles, KernelRefusal> => {
    const { authored, target } = request;
    const distribution = distributionId(target.name);
    if (!distribution.ok) return distribution;
    const directory = projectPath(target.directory);
    if (!directory.ok) return directory;
    const memoryRoot = projectPath(target.memoryRoot);
    return memoryRoot.ok ? accepted(serializeMethod({ method: authored.method,
      host: { distribution: distribution.value, directory: directory.value }, memoryRoot: memoryRoot.value }))
      : memoryRoot;
  };


const captureHost = async (capture: HostSourcesRequest,
  projection: Pick<BuildProjection, "readHostSources">):
    Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>> => {
    const distribution = distributionId(capture.name);
    if (!distribution.ok) return refused([distribution.refusal]);
    const directory = projectPath(capture.directory);
    if (!directory.ok) return refused([directory.refusal]);
    const host = { distribution: distribution.value, directory: directory.value };
    const surface = hostSurfaceMembers(host);
    const required = [...capture.required, ...hostSkillInputs(capture.name), ...hostSettingsInputs(capture.name),
      ...(surface?.placements.map((placement) => placement.source) ?? [])];
    const paths = [...new Set([...capture.copied, ...required])].map(sourcePath);
    const failures = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
    if (failures.length > 0) return refused(failures);
    const sources = paths.flatMap((path) => path.ok ? [path.value] : []);
    const files = await projection.readHostSources({ root: capture.root, host, sources,
      required: sources.filter((path) => required.includes(path)) });
    return files.ok ? accepted({ host, files: files.value }) : files;
  };


const runtimeProjector = (request: {
  readonly projection: Pick<BuildProjection, "readRuntime" | "projectRuntime">;
  readonly core: URL;
  readonly stamp: VersionStamp;
}): ProjectRuntime => {
  let captured: Promise<Result<SharedRuntime, readonly ProjectionRefusal[]>> | undefined;
  return async ({ host, method, tokens }) => {
    const runtime = await (captured ??= request.projection.readRuntime({
      core: request.core, method, stamp: request.stamp,
    }));
    if (!runtime.ok) return runtime;
    const projected = request.projection.projectRuntime({ host, runtime: runtime.value, tokens });
    return projected.ok ? projected : refused([projected.refusal]);
  };
};

export const createPackageBuildRoot: CreatePackageBuildRoot = (request) => {
  const loading = createAuthoredMethodLoading({ reader: request.platform.fileSystem,
    parser: request.platform.yaml, outliner: request.outliner });
  const projection = createBuildProjection({ hostFiles: request.platform.fileSystem, sessionFiles: request.platform.fileSystem,
    runnerProcess: request.platform.processRunner, runnerScratch: request.platform.fileSystem,
    runnerFrames: request.runnerFrames, runnerChild: new URL("./legacy-runner-child.ts", import.meta.url) });
  let sessions: Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>> | undefined;
  let core: MethodReading<CoreBuild> | undefined;
  const loadCore = async (): MethodReading<CoreBuild> => {
    const loaded = await loading.loadCore(request.sources.core);
    return loaded.ok ? accepted({ ...loaded.value,
      project: (target) => projectFor({ authored: loaded.value, target }, projection.serializeMethod) }) : loaded;
  };
  return {
    projectRuntime: runtimeProjector({ projection, core: request.sources.core,
      stamp: createBuildPackaging().stamp }),
    loadCore: () => core ??= loadCore(),
    loadPlugins: ({ core: loaded }) => loading.loadPlugins({ core: loaded,
      pluginsRoot: request.sources.plugins }),
    prepareCommandSource: ({ core: loaded, ...command }) => projection.prepareCommandSource({ ...command,
      method: loaded.method, sources: loaded.sources }),
    readHostSources: (host) => captureHost(host, projection),
    projectSettings: (settings) => {
      const members = hostSettingsMembers(settings.host);
      if (!members.ok) return members;
      return members.value === null ? accepted([])
        : projection.projectSettings({ ...settings, render: members.value.render });
    },
    projectHostSurface: (surface) => {
      const members = hostSurfaceMembers(surface.host);
      return members === null ? accepted([]) : projection.projectHostSurface({ ...surface,
        data: members.data, placements: members.placements });
    },
    projectSkills: async (skills) => {
      const members = hostSkillMembers(skills.host);
      if (!members.ok) return members;
      if (members.value === null) return accepted([]);
      const source = sourcePath("skills");
      if (!source.ok) return refused({ kind: "render-failed", concept: "session-skill", name: "skills",
        reason: "The session source path is invalid." });
      const captured = await (sessions ??= projection.readSessionSkills({ source: source.value,
        folder: new URL("skills/", request.sources.core) }));
      if (!captured.ok) return refused(captured.refusal[0] ?? {
        kind: "neutral-source-unreadable", source: source.value, reason: "The session source was refused." });
      return projection.projectSkills({ ...skills, render: members.value.render, sessions: captured.value });
    },
    projectAgents: (agents) => {
      const members = hostAgentMembers(agents.host);
      if (!members.ok) return members;
      return members.value === null ? accepted([])
        : projection.projectAgents({ ...agents, render: members.value.render });
    },
  };
};
