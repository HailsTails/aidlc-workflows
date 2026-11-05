import { pathToFileURL } from "node:url";
import type { Result } from "../values/result.ts";

export type ModuleLoad = Result<
  unknown,
  {
    readonly kind: "module-unloadable";
    readonly path: string;
    readonly detail: string;
  }
>;

export type ModuleLoaderPort = {
  readonly load: (request: { readonly path: string }) => Promise<ModuleLoad>;
};

export type ImportModule = (request: { readonly path: string }) => Promise<unknown>;

export const createModuleLoaderPort = (options: {
  readonly importModule: ImportModule;
}): ModuleLoaderPort => ({
  load: (request) =>
    Promise.resolve()
      .then(() => options.importModule({ path: request.path }))
      .then(
      (namespace: unknown) => ({ outcome: "ok", value: namespace }),
      (thrown: unknown) => ({
        outcome: "failed",
        error: {
          kind: "module-unloadable",
          path: request.path,
          detail: thrown instanceof Error ? thrown.message : String(thrown),
        },
      }),
    ),
});

export const defaultImportModule: ImportModule = (request) =>
  import(pathToFileURL(request.path).href);

export const createDefaultModuleLoaderPort = (
  _options: Record<string, never>,
): ModuleLoaderPort => createModuleLoaderPort({ importModule: defaultImportModule });
