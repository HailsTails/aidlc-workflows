import { createDefaultPathPort } from "./path-port.ts";

export type PackageLocationPort = {
  readonly installRoot: string;
  readonly locate: (request: { readonly packageName: string }) => string;
};

const path = createDefaultPathPort({});

const fileOf = (request: { readonly url: string }): string => {
  const file = path.fromFileUrl({ url: request.url });
  return file.outcome === "ok" ? file.value : request.url;
};

const INSTALL_ROOT = path.directoryOf({
  path: path.directoryOf({ path: path.directoryOf({ path: fileOf({ url: import.meta.url }) }) }),
});

export const createDefaultPackageLocationPort = (_options: Record<string, never>): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  locate: (request) => fileOf({ url: import.meta.resolve(request.packageName) }),
});
