import { readBuildVersion } from "./adapters/legacy-channel.ts";
import { createLegacyPayloadMetadata } from "./adapters/legacy-payload-metadata.ts";
import { createVersionStamp } from "./adapters/legacy-version.ts";
import { createCopyEraHistory } from "./adapters/copy-era-history.ts";
import { createBuildPackagingUseCase, selectOnboardingPath } from "./application/build-packaging.ts";
import type { FileSystem } from "../kernel/file-system-port.ts";
import type { NativeCommandRoutes } from "../projection/domain/native-command.ts";
import { accepted } from "../kernel/result.ts";
import { createBuildReleaseArtifact } from "./application/build-release-artifact.ts";
import { createLegacyArtifactWriter, legacyArchiveEncoder } from "./adapters/legacy-archive.ts";
import { createCopyRuntimeOmissions } from "./adapters/legacy-distribution.ts";
import { readPluginTreeFiles } from "./adapters/plugin-tree-files.ts";
import type { ContentHasher } from "./application/ports.ts";

import type { BuildPackaging, HostPayloadRequest } from "./application/ports.ts";
export type { BuildPackaging } from "./application/ports.ts";
export type { BuildReleaseArtifact } from "./application/use-cases.ts";
export { createPackageDistributions } from "./application/package-distributions.ts";
export { createOutputTrees } from "./adapters/output-trees.ts";
export { createPackagedSourcesFile } from "./adapters/packaged-sources-file.ts";
export { buildVersionNotice } from "./adapters/legacy-version.ts";
export type PhaseOnePackagingRequest = HostPayloadRequest;
export type OnboardingSource = Parameters<typeof selectOnboardingPath>[0];

export const createReleaseArtifacts = (binding: {
  readonly folder: URL; readonly fileSystem: FileSystem; readonly hasher: ContentHasher;
}) => ({
  ...createBuildReleaseArtifact({ writer: createLegacyArtifactWriter(binding, legacyArchiveEncoder),
    omissions: createCopyRuntimeOmissions() }),
  readPlugins: (root: URL) => readPluginTreeFiles({ root, fileSystem: binding.fileSystem }),
});

export const onboardingPathOf = (request: OnboardingSource) => selectOnboardingPath(request);

export const createBuildPackaging = (binding: {
  readonly routes: NativeCommandRoutes;
  readonly historyReader: Pick<FileSystem, "readFile">;
  readonly copyEraSource: URL;
}, readVersion = readBuildVersion): BuildPackaging => {
  const captured = readVersion();
  const history = createCopyEraHistory({ reader: binding.historyReader, source: binding.copyEraSource,
    prior: { history: async () => accepted({ retiredFiles: [], priorIntegrations: [] }) } });
  return createBuildPackagingUseCase({ version: captured, stamp: createVersionStamp(captured),
    routes: binding.routes, history, metadata: { forHost: createLegacyPayloadMetadata } });
};
