import { readBuildVersion } from "./adapters/legacy-channel.ts";
import { createLegacyPayloadMetadata } from "./adapters/legacy-payload-metadata.ts";
import { createVersionStamp } from "./adapters/legacy-version.ts";
import { createPackagePayload } from "./application/package-payload.ts";
import type { VersionStamp } from "./application/boundary-ports.ts";
import type { ContentHasher } from "./application/ports.ts";
import type { PackagePayload } from "./application/use-cases.ts";
import type { PackagingRefusal } from "./domain/artifact.ts";
import type { HostDistribution } from "./domain/payload.ts";
import type { HostData } from "../projection/domain/host-surface.ts";
import { accepted, type Result } from "../kernel/result.ts";
import { frameworkVersion, type FrameworkVersion, type KernelRefusal, type ProjectPath } from "../kernel/values.ts";

export type PhaseOnePackagingRequest = {
  readonly hasher: ContentHasher;
  readonly distribution: HostDistribution;
  readonly hostData: HostData;
  readonly onboarding: ProjectPath | undefined;
};

export type BuildPackaging = {
  readonly version: Result<FrameworkVersion, KernelRefusal | PackagingRefusal>;
  readonly stamp: VersionStamp;
  packagerFor(request: PhaseOnePackagingRequest): PackagePayload;
};

export const createBuildPackaging = (readVersion = readBuildVersion): BuildPackaging => {
  const captured = readVersion();
  const stamp = createVersionStamp(captured);
  return { version: captured.ok ? frameworkVersion(captured.value) : captured, stamp,
    packagerFor: ({ hasher, distribution, hostData, onboarding }) => createPackagePayload({ hasher, stamp,
      layouts: { layout: () => accepted(distribution.layout) },
      history: { history: async () => accepted({ retiredFiles: [], priorIntegrations: distribution.priorIntegrations }) },
      bundler: { bundle: async () => accepted([]) },
      metadata: createLegacyPayloadMetadata({ hasher, distribution, hostData,
        ...(onboarding ? { onboarding } : {}) }) }) };
};
