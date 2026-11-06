import { preparePluginDeclarationRuntime } from "./plugin-declaration.ts";
import { prepareProjectedPluginRuntimeArtifacts, type PluginRuntimeSourcePort, type ProjectedPluginRuntime, type RuntimeArtifact, type RuntimeCompilerPort } from "./plugin-runtime.ts";

export type CoreDeclarationRequest = { readonly pluginRoot: string; readonly file: string; readonly files: readonly string[]; readonly port: Pick<RuntimeCompilerPort, "declaration"> };
export type CoreRuntimeRequest = { readonly pluginRoot: string; readonly files: readonly string[]; readonly sourcePort: PluginRuntimeSourcePort; readonly runtimePort: RuntimeCompilerPort };
export type CoreRuntimePreparationOperations = {
  readonly declare: (input: CoreDeclarationRequest) => Promise<ProjectedPluginRuntime>;
  readonly prepare: (input: CoreRuntimeRequest) => Promise<ProjectedPluginRuntime>;
};
export const createCoreRuntimePreparationOperations = (): CoreRuntimePreparationOperations => ({ declare: preparePluginDeclarationRuntime, prepare: prepareProjectedPluginRuntimeArtifacts });

function runtimeInventory({ files, artifacts }: { readonly files: readonly string[]; readonly artifacts: readonly RuntimeArtifact[] }): readonly string[] {
  return Array.from(new Set([...files, ...artifacts.map((artifact) => artifact.file)]));
}

function combineCoreArtifacts({ declared, runtime }: { readonly declared: readonly RuntimeArtifact[]; readonly runtime: ProjectedPluginRuntime }): ProjectedPluginRuntime {
  if (runtime.kind !== "prepared") return runtime;
  const artifacts = [...declared, ...runtime.artifacts];
  const collision = artifacts.find((artifact) => artifacts.some((other) => other.file === artifact.file && other.content !== artifact.content));
  if (collision !== undefined) return { kind: "refused", message: `core runtime artifact collision: ${collision.file}` };
  return { kind: "prepared", artifacts: artifacts.filter((artifact, index) => artifacts.findIndex((other) => other.file === artifact.file) === index) };
}

export async function prepareCoreRuntimeArtifacts({ pluginRoot, files, sourcePort, runtimePort, operations = createCoreRuntimePreparationOperations() }: CoreRuntimeRequest & { readonly operations?: CoreRuntimePreparationOperations }): Promise<ProjectedPluginRuntime> {
  const declared = await operations.declare({ pluginRoot, file: "projection/plugin-hook-types.ts", files, port: runtimePort });
  if (declared.kind !== "prepared") return declared;
  const runtime = await operations.prepare({ pluginRoot, files: runtimeInventory({ files, artifacts: declared.artifacts }), sourcePort, runtimePort });
  return combineCoreArtifacts({ declared: declared.artifacts, runtime });
}
