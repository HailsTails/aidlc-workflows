import { type InstallForm, installRootAboveEntry } from "../values/install-layout.ts";
import type { Result } from "../values/result.ts";
import { createDefaultPathPort } from "./path-port.ts";

export type PackageUnlocatable = {
  readonly kind: "not-a-file-url";
  readonly url: string;
  readonly detail: string;
};

export type PackageLocationPort = {
  readonly installRoot: string;
  readonly installForm: InstallForm;
  readonly locate: (request: { readonly packageName: string }) => Result<string, PackageUnlocatable>;
};

const path = createDefaultPathPort({});

export const installRootOfRunnerEntry = (request: { readonly entryFile: string }): string =>
  installRootAboveEntry({ entryFile: request.entryFile, entry: "runner", directoryOf: (folder) => path.directoryOf({ path: folder }) });

export const createDefaultPackageLocationPort = (options: {
  readonly installRoot: string;
  readonly installForm: InstallForm;
}): PackageLocationPort => ({
  installRoot: options.installRoot,
  installForm: options.installForm,
  locate: (request) => path.fromFileUrl({ url: import.meta.resolve(request.packageName) }),
});
