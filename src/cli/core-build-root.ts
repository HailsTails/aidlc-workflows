import { accepted, type Result } from "../kernel/result.ts";
import { distributionId, projectPath, type KernelRefusal } from "../kernel/values.ts";
import { serializeCompiledMethod } from "../projection/core-root.ts";
import { loadAuthoredCoreMethod } from "../workflow-definition/core-root.ts";

// Phase 1's core-only production path. Complete Harness/Packaging composition
// replaces the remaining legacy producers as their rendered concepts land.
export const loadCoreBuild = async (request: {
  readonly coreRoot: string | URL;
  readonly markdownBlocks: Parameters<typeof loadAuthoredCoreMethod>[0]["markdownBlocks"];
}) => {
  const loaded = await loadAuthoredCoreMethod(request);
  if (!loaded.ok) return loaded;
  const { method, sources } = loaded.value;
  const project = (target: { readonly name: string; readonly directory: string;
    readonly memoryRoot: string }): Result<ReturnType<typeof serializeCompiledMethod>, KernelRefusal> => {
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
  return accepted({ method, sources, project });
};
