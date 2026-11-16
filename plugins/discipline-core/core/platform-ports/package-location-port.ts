import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type PackageLocationPort = {
  readonly installRoot: string;
  readonly locate: (request: { readonly packageName: string }) => string;
};

const PORT_FILE = fileURLToPath(import.meta.url);

const INSTALL_ROOT = dirname(dirname(dirname(PORT_FILE)));

export const createDefaultPackageLocationPort = (_options: Record<string, never>): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  locate: (request) => fileURLToPath(import.meta.resolve(request.packageName)),
});
