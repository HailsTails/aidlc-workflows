import type { Workspace } from "./ports.ts";

const LEGACY_MANIFESTS = "harness/*/manifest.ts";
const REGISTERED_HOSTS = "src/hosts/*/host-data.ts";

const namesFrom = (workspace: Workspace, glob: string, nameIndex: number): readonly string[] =>
  workspace
    .filesMatching([glob])
    .map((path) => path.split("/")[nameIndex] ?? "")
    .filter((name) => name !== "");

export const discoveredHarnesses = (workspace: Workspace): readonly string[] => [
  ...new Set([
    ...namesFrom(workspace, LEGACY_MANIFESTS, 1),
    ...namesFrom(workspace, REGISTERED_HOSTS, 2),
  ]),
];
