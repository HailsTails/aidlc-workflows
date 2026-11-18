import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import type { PackagingRefusal } from "./artifact.ts";
import type { Payload } from "./payload.ts";
import { orderedPayloadFiles } from "./payload-files.ts";
import type { RootIntegration } from "./root-integration.ts";

export const duplicateRootIntegrations = (
  roots: readonly RootIntegration[],
): readonly PackagingRefusal[] => {
  const paths = new Set<ProjectPath>();
  return roots.flatMap((root): readonly PackagingRefusal[] => {
    if (paths.has(root.path)) return [{ kind: "root-integration-duplicate", path: root.path }];
    paths.add(root.path);
    return [];
  });
};

const undeclaredPayloadFiles = (releasePayload: Payload): readonly PackagingRefusal[] => releasePayload.files
  .filter((file) => !releasePayload.descriptor.layout.rootIntegrations.some((root) =>
    root.path === file.path) && !releasePayload.descriptor.layout.managedDirectories.some((directory) =>
    file.path.startsWith(`${directory.path}/`)))
  .map((file) => file.origin.kind === "projected"
    ? { kind: "path-undeclared", path: file.path, origin: file.origin.origin }
    : { kind: "entry-not-bundled", entry: file.path,
      reason: "Declare the generated file's directory in the distribution layout." });

export const completePayload = (releasePayload: Payload): Result<Payload, readonly PackagingRefusal[]> => {
  const duplicates = duplicateRootIntegrations(releasePayload.descriptor.layout.rootIntegrations);
  if (duplicates.length > 0) return refused(duplicates);
  const ordered = orderedPayloadFiles(releasePayload.files);
  if (!ordered.ok) return ordered;
  const completed = { ...releasePayload, files: ordered.value };
  const undeclared = undeclaredPayloadFiles(completed);
  return undeclared.length > 0 ? refused(undeclared) : accepted(completed);
};
