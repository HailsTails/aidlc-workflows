import type { HostIdentity } from "../kernel/host.ts";
import type { AuthoredHostFile } from "../projection/domain/host-surface.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";
import { accepted, refused, type Result } from "../kernel/result.ts";
import { distributionId, projectPath, sourcePath, type KernelRefusal } from "../kernel/values.ts";
import { serializeCompiledMethod, createCommandRenderers, prepareLegacyRunners, projectMethodCommands,
  createHostSurfaceReader, type CompiledMethodFiles } from "../projection/core-root.ts";
import type { CommandPlacement, Rendering } from "../projection/application/ports.ts";
import { loadAuthoredCoreMethod, type AuthoredCoreMethod } from "../workflow-definition/core-root.ts";
import type { MethodRefusal } from "../workflow-definition/domain/refusals.ts";

export type CoreBuildTarget = { readonly name: string; readonly directory: string;
  readonly memoryRoot: string };

export type CoreBuild = AuthoredCoreMethod & {
  readonly project: (target: CoreBuildTarget) => Result<CompiledMethodFiles, KernelRefusal>;
};

export const loadCoreBuild = async (request: {
  readonly coreRoot: string | URL;
  readonly markdownBlocks: Parameters<typeof loadAuthoredCoreMethod>[0]["markdownBlocks"];
}): Promise<Result<CoreBuild, readonly MethodRefusal[]>> => {
  const loaded = await loadAuthoredCoreMethod(request);
  if (!loaded.ok) return loaded;
  const { method } = loaded.value;
  const project = (target: CoreBuildTarget): Result<CompiledMethodFiles, KernelRefusal> => {
    const distribution = distributionId(target.name);
    if (!distribution.ok) return distribution;
    const directory = projectPath(target.directory);
    if (!directory.ok) return directory;
    const memoryRoot = projectPath(target.memoryRoot);
    if (!memoryRoot.ok) return memoryRoot;
    return accepted(serializeCompiledMethod({ method,
      host: { distribution: distribution.value, directory: directory.value },
      memoryRoot: memoryRoot.value }));
  };
  return accepted({ ...loaded.value, project });
};

export const projectCoreCommands = (request: Parameters<typeof prepareLegacyRunners>[0] & {
  readonly place: CommandPlacement;
}): Rendering => projectMethodCommands({ method: request.method,
  harness: createCommandRenderers({ source: prepareLegacyRunners(request), place: request.place }) });

export { loadAuthoredPluginBuild as loadPluginBuildCatalog, reviewerAgentSet, inlineAgentSet,
  type AuthoredPluginBuild as PluginBuildCatalog, type PluginBuildTarget }
  from "../workflow-definition/core-root.ts";

export { pluginId as pluginBuildName } from "../workflow-definition/domain/identities.ts";

export const loadHostBuildSources = async (request: {
  readonly name: string;
  readonly directory: string;
  readonly root: string;
  readonly copied: readonly string[];
  readonly required: readonly string[];
}): Promise<Result<{ readonly host: HostIdentity; readonly files: readonly AuthoredHostFile[] },
  readonly (KernelRefusal | ProjectionRefusal)[]>> => {
  const distribution = distributionId(request.name);
  if (!distribution.ok) return refused([distribution.refusal]);
  const directory = projectPath(request.directory);
  if (!directory.ok) return refused([directory.refusal]);
  const paths = [...new Set([...request.copied, ...request.required])].map(sourcePath);
  const failures = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
  if (failures.length > 0) return refused(failures);
  const sources = paths.flatMap((path) => path.ok ? [path.value] : []);
  const host = { distribution: distribution.value, directory: directory.value };
  const files = await createHostSurfaceReader({ root: request.root, host, sources,
    required: sources.filter((path) => request.required.includes(path)) }).read({ host });
  return files.ok ? accepted({ host, files: files.value }) : files;
};

export { prepareHostSource } from "../projection/core-root.ts";
