import { relative, sep } from "node:path";
import { selectPluginRuntimeProducts, type PluginRuntimeSelection } from "./plugin-runtime-selection.ts";
import {
  createPluginRuntimeCompiler, createPluginRuntimeSourcePort, createPluginRuntimeArtifactPort,
  prepareProjectedPluginRuntimeArtifacts, publishPluginRuntimeArtifacts, type RuntimePublication, type ProjectedPluginRuntime,
} from "./plugin-runtime.ts";

export type PluginRuntimeProjectionPort = {
  readonly prepare: (request: { readonly pluginRoot: string; readonly files: readonly string[]; readonly closedModules: readonly string[] }) => Promise<ProjectedPluginRuntime>;
  readonly publish: (request: { readonly outDir: string; readonly prepared: ProjectedPluginRuntime }) => Promise<RuntimePublication>;
};

export function createPluginRuntimeProjectionPort(input: { readonly projectRoot: string }): PluginRuntimeProjectionPort {
  return {
    prepare: async (request) => {
      const compiler = await createPluginRuntimeCompiler(input);
      if (compiler.kind === "unavailable") return compiler;
      return prepareProjectedPluginRuntimeArtifacts({ ...request, sourcePort: createPluginRuntimeSourcePort(), runtimePort: compiler.port });
    },
    publish: (request) => publishPluginRuntimeArtifacts({ ...request, port: createPluginRuntimeArtifactPort() }),
  };
}

function pluginRuntimeInventory(input: { readonly outDir: string; readonly pluginRoot: string; readonly files: readonly string[] }): readonly string[] {
  const prefix = relative(input.outDir, input.pluginRoot).split(sep).join("/");
  return input.files.filter((file) => prefix === "" || file.startsWith(prefix + "/"))
    .map((file) => prefix === "" ? file : file.slice(prefix.length + 1));
}

function projectionProviderFailure(input: { readonly outDir: string }): Extract<RuntimePublication, { readonly kind: "unavailable" }> {
  return { kind: "unavailable", error: { kind: "artifact-provider-failed", outDir: input.outDir,
    file: "", message: "Plugin runtime projection provider failed", writtenFiles: [] } };
}

type PluginRuntimePreparation = {
  readonly pluginRoot: string;
  readonly outDir: string;
  readonly files: readonly string[];
  readonly closedModules: readonly string[];
  readonly port: PluginRuntimeProjectionPort;
};

async function attemptPluginRuntimePreparation(input: PluginRuntimePreparation): Promise<ProjectedPluginRuntime> {
  try {
    return await input.port.prepare({ pluginRoot: input.pluginRoot, files: input.files, closedModules: input.closedModules });
  } catch {
    return projectionProviderFailure(input);
  }
}

async function publishPreparedPluginRuntime(input: {
  readonly outDir: string;
  readonly prepared: ProjectedPluginRuntime;
  readonly port: PluginRuntimeProjectionPort;
}): Promise<RuntimePublication> {
  switch (input.prepared.kind) {
    case "refused": return input.prepared;
    case "unavailable": return input.prepared;
    case "prepared": return attemptPluginRuntimePublication({ ...input, prepared: input.prepared });
  }
}

async function attemptPluginRuntimePublication(input: {
  readonly outDir: string;
  readonly prepared: Extract<ProjectedPluginRuntime, { readonly kind: "prepared" }>;
  readonly port: PluginRuntimeProjectionPort;
}): Promise<RuntimePublication> {
  try {
    return await input.port.publish({ outDir: input.outDir, prepared: input.prepared });
  } catch {
    return projectionProviderFailure(input);
  }
}

async function prepareAndPublishPluginRuntime(input: PluginRuntimePreparation): Promise<RuntimePublication> {
  return publishPreparedPluginRuntime({ outDir: input.outDir, prepared: await attemptPluginRuntimePreparation(input), port: input.port });
}

type PluginRuntimeSelectionCompletion = {
  readonly projectRoot: string;
  readonly pluginRoot: string;
  readonly outDir: string;
  readonly selected: PluginRuntimeSelection;
  readonly port: PluginRuntimeProjectionPort | undefined;
};

function completePluginRuntimeSelection(input: PluginRuntimeSelectionCompletion): Promise<RuntimePublication> {
  switch (input.selected.kind) {
    case "refused": return Promise.resolve(input.selected);
    case "not-needed": return Promise.resolve({ kind: "published", files: [] });
    case "selected": return prepareSelectedRuntimeProducts({ ...input, selected: input.selected });
  }
}

function prepareSelectedRuntimeProducts(input: PluginRuntimeSelectionCompletion & {
  readonly selected: Extract<PluginRuntimeSelection, { readonly kind: "selected" }>;
}): Promise<RuntimePublication> {
  return prepareAndPublishPluginRuntime({
    pluginRoot: input.pluginRoot, outDir: input.outDir, files: input.selected.files,
    closedModules: input.selected.closedModules, port: input.port ?? createPluginRuntimeProjectionPort({ projectRoot: input.projectRoot }),
  });
}

export async function projectDeclaredPluginRuntime(input: {
  readonly projectRoot: string;
  readonly pluginRoot: string;
  readonly port?: PluginRuntimeProjectionPort;
  readonly projection: {
    readonly harness: string;
    readonly outDir: string;
    readonly pluginRoot: string;
    readonly files: readonly string[];
    readonly commandScripts: readonly string[];
  };
}): Promise<RuntimePublication> {
  const files = pluginRuntimeInventory(input.projection);
  const selected = selectPluginRuntimeProducts({ harness: input.projection.harness, files, commandScripts: input.projection.commandScripts });
  return completePluginRuntimeSelection({
    pluginRoot: input.pluginRoot, projectRoot: input.projectRoot, outDir: input.projection.pluginRoot,
    selected, port: input.port,
  });
}
