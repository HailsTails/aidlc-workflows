import { pathToFileURL } from "node:url";
import type { Result } from "../values/result.ts";

export type ModuleLoaderPort = {
  readonly load: (request: { readonly path: string }) => Promise<
    Result<
      unknown,
      {
        readonly kind: "module-unloadable";
        readonly path: string;
        readonly detail: string;
      }
    >
  >;
};

export const createModuleLoaderPort = (
  _options: Record<string, never>,
): ModuleLoaderPort => ({
  load: (request) =>
    import(pathToFileURL(request.path).href).then(
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
