import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { DistributionLayouts, VersionStamp } from "./boundary-ports.ts";
import type { ContentHasher, ReleaseHistorySource, ToolBundler } from "./ports.ts";
import type { PackagePayload, PackagePayloadRequest } from "./use-cases.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { Payload, PayloadFile } from "../domain/payload.ts";
import { orderedPayloadFiles } from "../domain/payload-files.ts";

export interface PayloadMetadata {
  files(releasePayload: Payload): readonly PayloadFile[];
}

type Dependencies = {
  readonly bundler: ToolBundler;
  readonly hasher: ContentHasher;
  readonly layouts: DistributionLayouts;
  readonly history: ReleaseHistorySource;
  readonly metadata: PayloadMetadata;
  readonly stamp: VersionStamp;
};

const projectionFiles = (request: {
  readonly package: PackagePayloadRequest;
  readonly hasher: ContentHasher;
}): readonly PayloadFile[] => request.package.projection.files
  .filter((file) => file.availability === "always"
    || file.availability === `${request.package.channel}-only`)
  .map((file) => ({ path: file.path, content: file.content, mode: file.mode,
    hash: request.hasher.hash(file.content),
    origin: { kind: "projected", origin: file.origin },
  }));

const stampedVersionModule = (request: {
  readonly files: readonly PayloadFile[];
  readonly stamp: VersionStamp;
  readonly hasher: ContentHasher;
}): Result<readonly PayloadFile[], PackagingRefusal> => {
  const modules = request.files.filter((file) => file.origin.kind === "projected"
    && file.origin.origin.kind === "runtime-data" && file.origin.origin.name === "version-module");
  const [versionModule] = modules;
  if (!versionModule || modules.length !== 1) return refused({ kind: "version-module-count", found: modules.length });
  const stamped = request.stamp(versionModule.content);
  if (!stamped.ok) return stamped;
  return accepted(request.files.map((file) => file === versionModule
    ? { ...file, content: stamped.value, hash: request.hasher.hash(stamped.value) } : file));
};

const missingEntries = (request: {
  readonly package: PackagePayloadRequest;
  readonly files: readonly PayloadFile[];
}): readonly PackagingRefusal[] => request.package.runtime
  .filter((entry) => !request.files.some((file) => file.origin.kind === "bundled-runtime"
    && file.origin.entry.name === entry.name
    && file.origin.entry.compositionRoot === entry.compositionRoot))
  .map((entry) => ({ kind: "entry-not-bundled", entry: entry.name,
    reason: "The bundler returned no file for this entry point.",
  }));

const declaredFiles = (releasePayload: Payload): readonly PackagingRefusal[] => releasePayload.files
  .filter((file) => !releasePayload.descriptor.layout.rootIntegrations.some((root) =>
    root.path === file.path) && !releasePayload.descriptor.layout.managedDirectories.some((directory) =>
    file.path.startsWith(`${directory.path}/`)))
  .map((file) => file.origin.kind === "projected"
    ? { kind: "path-undeclared", path: file.path, origin: file.origin.origin }
    : { kind: "entry-not-bundled", entry: file.path,
      reason: "Declare the generated file's directory in the distribution layout." });

const assemble = (request: {
  readonly payload: Payload;
  readonly dependencies: Dependencies;
}): ReturnType<PackagePayload["package"]> => {
  const metadataFiles = request.dependencies.metadata.files(request.payload);
  const ordered = orderedPayloadFiles([...request.payload.files, ...metadataFiles]);
  if (!ordered.ok) return Promise.resolve(ordered);
  const releasePayload = { ...request.payload, files: ordered.value };
  const issues = declaredFiles(releasePayload);
  return Promise.resolve(issues.length > 0 ? refused(issues) : accepted(releasePayload));
};

export const createPackagePayload = (dependencies: Dependencies): PackagePayload => ({
  async package(request) {
    const host = request.projection.host;
    const layout = dependencies.layouts.layout(host.distribution);
    if (!layout.ok) return refused([layout.refusal]);
    const history = await dependencies.history.history(host.distribution);
    if (!history.ok) return refused([history.refusal]);
    const bundled = await dependencies.bundler.bundle({ entries: request.runtime,
      channel: request.channel });
    if (!bundled.ok) return refused([bundled.refusal]);
    const missing = missingEntries({ package: request, files: bundled.value });
    if (missing.length > 0) return refused(missing);
    const projected = stampedVersionModule({ stamp: dependencies.stamp, hasher: dependencies.hasher,
      files: projectionFiles({ package: request, hasher: dependencies.hasher }) });
    if (!projected.ok) return refused([projected.refusal]);
    const files = [
      ...projected.value,
      ...bundled.value.map((file) => ({ ...file, hash: dependencies.hasher.hash(file.content) })),
    ];
    return assemble({ dependencies, payload: { version: request.version,
      channel: request.channel, descriptor: { host, layout: layout.value,
        history: history.value }, files } });
  },
});
