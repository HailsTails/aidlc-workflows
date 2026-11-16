import type { Result } from "../values/result.ts";
import { createDefaultPathPort } from "./path-port.ts";

export type PackageUnlocatable = {
  readonly kind: "not-a-file-url";
  readonly url: string;
  readonly detail: string;
};

export type PackageLocationPort = {
  readonly installRoot: string;
  readonly locate: (request: { readonly packageName: string }) => Result<string, PackageUnlocatable>;
};

const path = createDefaultPathPort({});

const INSTALL_ROOT = path.directoryOf({ path: path.directoryOf({ path: import.meta.dirname }) });

export const createDefaultPackageLocationPort = (_options: Record<string, never>): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  locate: (request) => path.fromFileUrl({ url: import.meta.resolve(request.packageName) }),
});
