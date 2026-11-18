import { accepted } from "../../kernel/result.ts";
import type { AuthoredCoreMethod, AuthoredPluginBuild, AuthoredTreeReader,
  MethodContentDecoder, MethodReading } from "./ports.ts";
import { compileCoreMethod } from "../domain/compile-core-method.ts";
import { createAuthoredMethodReader, createPluginSelectionSource } from "./authored-method-reader.ts";
import { captureCoreMethodFiles, capturePluginMethodFiles } from "./capture-method-files.ts";
import type { CompileMethod } from "./use-cases.ts";
import { createMethodLoader } from "./create-method-loader.ts";

export const loadCoreMethod = async (request: {
  readonly coreRoot: URL;
  readonly reader: AuthoredTreeReader;
  readonly decoder: MethodContentDecoder;
}): MethodReading<AuthoredCoreMethod> => {
  const capture = await captureCoreMethodFiles({ root: request.coreRoot, reader: request.reader });
  if (!capture.ok) return capture;
  const authored = await request.decoder.decodeCore(capture.value);
  if (!authored.ok) return authored;
  const method = compileCoreMethod(authored.value.core);
  return method.ok ? accepted({ method: method.value,
    authored: authored.value.core, sources: authored.value.files }) : method;
};

export const loadPluginMethod = async (request: {
  readonly core: AuthoredCoreMethod;
  readonly pluginsRoot: URL;
  readonly reader: AuthoredTreeReader;
  readonly decoder: MethodContentDecoder;
  readonly compiler: CompileMethod;
}): MethodReading<AuthoredPluginBuild> => {
  const capture = await capturePluginMethodFiles({ root: request.pluginsRoot, reader: request.reader });
  if (!capture.ok) return capture;
  const reader = createAuthoredMethodReader({ core: { core: request.core.authored, files: request.core.sources },
    plugins: capture.value, decoder: request.decoder });
  const authored = await reader.readAuthored();
  if (!authored.ok) return authored;
  const loader = createMethodLoader({ reader: { readAuthored: async () => authored },
    selection: createPluginSelectionSource({ kind: "every-installed" }),
    compiler: request.compiler });
  const compiled = await loader.loadAuthored();
  return compiled.ok ? accepted({ method: compiled.value,
    plugins: compiled.value.installedPlugins.flatMap((plugin) =>
      authored.value.plugins.filter((target) => target.plugin === plugin)) }) : compiled;
};
