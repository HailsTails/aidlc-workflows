import type { SessionSkill } from "../projection/domain/neutral-surface.ts";
import type { BuildProjection } from "../projection/application/ports.ts";
import { hostAgentMembers, hostSkillMembers, hostSkillInputs } from "./host-table.ts";
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


export const createPackageBuildRoot: CreatePackageBuildRoot = (request) => {
  const loading = createAuthoredMethodLoading({ reader: request.platform.fileSystem,
    parser: request.platform.yaml, outliner: request.outliner });
  const projection = createBuildProjection({ hostFiles: request.platform.fileSystem, sessionFiles: request.platform.fileSystem,
    runnerProcess: request.platform.processRunner, runnerScratch: request.platform.fileSystem,
    runnerFrames: request.runnerFrames, runnerChild: new URL("./legacy-runner-child.ts", import.meta.url) });
  const captureHost = async (capture: HostSourcesRequest):
    Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>> => {
    const distribution = distributionId(capture.name);
    if (!distribution.ok) return refused([distribution.refusal]);
    const directory = projectPath(capture.directory);
    if (!directory.ok) return refused([directory.refusal]);
    const paths = [...new Set([...capture.copied, ...capture.required, ...hostSkillInputs(capture.name)])].map(sourcePath);
    const failures = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
    if (failures.length > 0) return refused(failures);
    const sources = paths.flatMap((path) => path.ok ? [path.value] : []);
    const host = { distribution: distribution.value, directory: directory.value };
    const files = await projection.readHostSources({ root: capture.root, host, sources,
      required: sources.filter((path) => capture.required.includes(path) || hostSkillInputs(capture.name).includes(path)) });
    return files.ok ? accepted({ host, files: files.value }) : files;
  };

  let sessions: Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>> | undefined;
  let core: MethodReading<CoreBuild> | undefined;
  const loadCore = async (): MethodReading<CoreBuild> => {
    const loaded = await loading.loadCore(request.sources.core);
    return loaded.ok ? accepted({ ...loaded.value,
      project: (target) => projectFor({ authored: loaded.value, target }, projection.serializeMethod) }) : loaded;
  };
  return {
    loadCore: () => core ??= loadCore(),
    loadPlugins: ({ core: loaded }) => loading.loadPlugins({ core: loaded,
      pluginsRoot: request.sources.plugins }),
    prepareCommandSource: ({ core: loaded, ...command }) => projection.prepareCommandSource({ ...command,
      method: loaded.method, sources: loaded.sources }),
    readHostSources: (host) => captureHost(host),
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
