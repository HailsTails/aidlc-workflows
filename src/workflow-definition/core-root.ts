import { accepted, type Result } from "../kernel/result.ts";
import { readAuthoredCore } from "./adapters/authored-core-reader.ts";
import { createMarkdownOutliner } from "./adapters/markdown-outliner.ts";
import { captureRepositoryPlugins, createSourceFiles } from "./adapters/source-files.ts";
import { compileCoreMethod } from "./domain/compile-core-method.ts";

import { createAuthoredMethodReader, createPluginSelectionSource,
  type PluginBuildTarget } from "./adapters/authored-method-reader.ts";
import { createMethodCompiler } from "./application/create-method-compiler.ts";
import type { CoreContent, Method } from "./domain/method.ts";
import type { MethodSource } from "./domain/method-source.ts";
import type { MethodRefusal } from "./domain/refusals.ts";

export type AuthoredCoreMethod = { readonly method: Method; readonly authored: CoreContent;
  readonly sources: readonly MethodSource[] };

export const loadAuthoredCoreMethod = async (request: {
  readonly coreRoot: string | URL;
  readonly markdownBlocks: Parameters<typeof createMarkdownOutliner>[0];
}): Promise<Result<AuthoredCoreMethod, readonly MethodRefusal[]>> => {
  const authored = await readAuthoredCore({ sourceFiles: createSourceFiles(request.coreRoot),
    outliner: createMarkdownOutliner(request.markdownBlocks), hooks: [] });
  if (!authored.ok) return authored;
  const compiled = compileCoreMethod(authored.value.core);
  return compiled.ok ? accepted({ method: compiled.value, authored: authored.value.core, sources: authored.value.files }) : compiled;
};

export type AuthoredPluginBuild = { readonly method: Method;
  readonly plugins: readonly PluginBuildTarget[] };
export type { PluginBuildTarget } from "./adapters/authored-method-reader.ts";

export const loadAuthoredPluginBuild = async (request: {
  readonly core: AuthoredCoreMethod;
  readonly pluginsRoot: string | URL;
  readonly markdownBlocks: Parameters<typeof createMarkdownOutliner>[0];
}): Promise<Result<AuthoredPluginBuild, readonly MethodRefusal[]>> => {
  const outliner = createMarkdownOutliner(request.markdownBlocks);
  const captures = await captureRepositoryPlugins(request.pluginsRoot);
  const reader = createAuthoredMethodReader({
    core: { core: request.core.authored, files: request.core.sources }, plugins: captures, outliner });
  const authored = await reader.readAuthored();
  if (!authored.ok) return authored;
  const selection = createPluginSelectionSource({ kind: "every-installed" });
  const compiled = createMethodCompiler(outliner).compile({ ...authored.value,
    selection: await selection.readSelection() });
  return compiled.ok ? accepted({ method: compiled.value,
    plugins: compiled.value.installedPlugins.flatMap((plugin) =>
      authored.value.pluginDirectories.filter((directory) => directory.plugin === plugin)) }) : compiled;
};
