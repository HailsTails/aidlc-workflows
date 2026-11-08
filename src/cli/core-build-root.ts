import { accepted, type Result } from "../kernel/result.ts";
import { distributionId, projectPath, type KernelRefusal } from "../kernel/values.ts";
import { serializeCompiledMethod, createCommandRenderers, prepareLegacyRunners, projectMethodCommands,
  type CompiledMethodFiles } from "../projection/core-root.ts";
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

export { loadAuthoredPluginBuild as loadPluginBuildCatalog,
  type AuthoredPluginBuild as PluginBuildCatalog, type PluginBuildTarget }
  from "../workflow-definition/core-root.ts";
