export type InstallEntry = "command" | "runner";

const FOLDERS_BETWEEN_INSTALL_ROOT_AND_ENTRY: Readonly<Record<InstallEntry, number>> = {
  command: 2,
  runner: 3,
};

export const installRootAboveEntry = (request: {
  readonly entryFile: string;
  readonly entry: InstallEntry;
  readonly directoryOf: (path: string) => string;
}): string =>
  Array.from({ length: FOLDERS_BETWEEN_INSTALL_ROOT_AND_ENTRY[request.entry] + 1 }).reduce<string>(
    (path) => request.directoryOf(path),
    request.entryFile,
  );

export type ModuleExtension = ".ts" | ".js";

export const BUILT_MODULE_EXTENSION: ModuleExtension = ".js";

const SOURCE_MODULE_EXTENSION: ModuleExtension = ".ts";

export const moduleExtensionOf = (request: { readonly moduleUrl: string }): ModuleExtension =>
  new URL(request.moduleUrl).pathname.endsWith(BUILT_MODULE_EXTENSION) ? BUILT_MODULE_EXTENSION : SOURCE_MODULE_EXTENSION;

export const runnerModuleSegmentsOf = (request: {
  readonly installRoot: string;
  readonly mechanism: string;
  readonly moduleExtension: ModuleExtension;
}): readonly string[] => [request.installRoot, "mechanisms", request.mechanism, "runner", `runner${request.moduleExtension}`];

const MODULE_EXTENSIONS: readonly ModuleExtension[] = [SOURCE_MODULE_EXTENSION, BUILT_MODULE_EXTENSION];

export const moduleFileForm = (request: { readonly text: string }): "module-file" | "not-module-file" =>
  MODULE_EXTENSIONS.some((extension) => request.text.endsWith(extension)) ? "module-file" : "not-module-file";
