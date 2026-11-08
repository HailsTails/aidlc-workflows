import { distributionDirectoryFindings, type DistributionFile, type DistributionDirectory } from "./distribution-artifact.ts";
import type { SourceContentDigest } from "./source-origin.ts";
import { finding, pathStatus, type Outcome } from "./model.ts";

export type DistributionRoot = { readonly files: readonly DistributionFile[]; readonly directories: readonly DistributionDirectory[] };
export type HostRootChanges = {
  readonly added: readonly string[];
  readonly replaced: readonly string[];
  readonly removed: readonly string[];
  readonly directoriesAdded: readonly string[];
  readonly directoriesChanged: readonly string[];
  readonly directoriesRemoved: readonly string[];
};
export type PreparedHostRoot = DistributionRoot & HostRootChanges & {
  readonly inputs: readonly SourceContentDigest[];
  readonly diagnostics?: { readonly stdout: string; readonly stderr: string };
};
export type DistributionFileComparison = "unchanged" | "content-changed" | "mode-changed" | "content-and-mode-changed";
// Path membership belongs to the root comparison; this compares one file's payload.
export function compareDistributionFile(left: DistributionFile, right: DistributionFile): DistributionFileComparison {
  const content = left.bytes.length === right.bytes.length && left.bytes.every((byte, index) => byte === right.bytes[index]) ? "unchanged" : "changed";
  if (left.mode === right.mode) return content === "unchanged" ? "unchanged" : "content-changed";
  return content === "unchanged" ? "mode-changed" : "content-and-mode-changed";
}
function parentDirectories(path: string): readonly string[] {
  const segments = path.split("/").slice(0, -1);
  return segments.map((_segment, index) => segments.slice(0, index + 1).join("/"));
}
export function hostRootChanges(before: DistributionRoot, after: DistributionRoot): HostRootChanges {
  return {
    added: after.files.filter(file => !before.files.some(prior => prior.path === file.path)).map(file => file.path).sort(),
    replaced: after.files.filter(file => { const prior = before.files.find(prior => prior.path === file.path); return prior !== undefined && compareDistributionFile(prior, file) !== "unchanged"; }).map(file => file.path).sort(),
    removed: before.files.filter(file => !after.files.some(next => next.path === file.path)).map(file => file.path).sort(),
    directoriesAdded: after.directories.filter(directory => !before.directories.some(prior => prior.path === directory.path)).map(directory => directory.path).sort(),
    directoriesChanged: after.directories.filter(directory => before.directories.some(prior => prior.path === directory.path && prior.mode !== directory.mode)).map(directory => directory.path).sort(),
    directoriesRemoved: before.directories.filter(directory => !after.directories.some(next => next.path === directory.path)).map(directory => directory.path).sort(),
  };
}
export function admitPreparedHostRoot(before: DistributionRoot, prepared: PreparedHostRoot): Outcome<PreparedHostRoot> {
  const paths = [...prepared.files, ...prepared.directories].map(entry => entry.path.toLowerCase());
  const changes = hostRootChanges(before, prepared);
  const findings = [
    ...distributionDirectoryFindings({ ...prepared, path: pathStatus }),
    ...prepared.files.flatMap(file => pathStatus({ path: file.path }) !== "safe" || !Number.isInteger(file.mode) || file.mode < 0 || file.mode > 0o777 ? [finding({ code: "invalid-input", subject: file.path, detail: "prepared host files require safe paths and explicit permission modes" })] : []),
    ...(new Set(paths).size !== paths.length ? [finding({ code: "destination-collision", subject: "host-emission", detail: "prepared host paths cannot be duplicated or differ only by case" })] : []),
    ...[...prepared.files, ...prepared.directories].flatMap(entry => parentDirectories(entry.path).flatMap(parent => prepared.directories.some(directory => directory.path === parent) ? [] : [finding({ code: "invalid-input", subject: parent, detail: "prepared host roots require every actual parent directory" })])),
    ...(["added", "replaced", "removed", "directoriesAdded", "directoriesChanged", "directoriesRemoved"] as const).flatMap(kind => JSON.stringify(prepared[kind]) === JSON.stringify(changes[kind]) ? [] : [finding({ code: "foreign-content", subject: kind, detail: "host amendment declarations must agree with independently compared before and after bytes and modes" })]),
  ];
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: prepared };
}
