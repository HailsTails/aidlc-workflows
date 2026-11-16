import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installRootAboveEntry } from "../values/install-layout.ts";

export type PackageLocationPort = {
  readonly installRoot: string;
  readonly locate: (request: { readonly packageName: string }) => string;
};

export const installRootOfRunnerEntry = (request: { readonly entryUrl: string }): string =>
  installRootAboveEntry({ entryFile: fileURLToPath(request.entryUrl), entry: "runner", directoryOf: dirname });

export const createDefaultPackageLocationPort = (options: { readonly installRoot: string }): PackageLocationPort => ({
  installRoot: options.installRoot,
  locate: (request) => fileURLToPath(import.meta.resolve(request.packageName)),
});
