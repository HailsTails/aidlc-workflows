import { readBuildVersion } from "./adapters/legacy-channel.ts";
import { createLegacyPayloadMetadata } from "./adapters/legacy-payload-metadata.ts";
import { createVersionStamp } from "./adapters/legacy-version.ts";
import { createPackagePayload } from "./application/package-payload.ts";
import type { VersionStamp } from "./application/boundary-ports.ts";
import type { ContentHasher } from "./application/ports.ts";
import type { PackagingRefusal } from "./domain/artifact.ts";
import type { HostDistribution } from "./domain/payload.ts";
import type { HostData } from "../projection/domain/host-surface.ts";
import type { Projection } from "../projection/domain/projection.ts";
import type { DistributionChannel, ProjectedFile } from "../projection/domain/projected-file.ts";
import type { Payload } from "./domain/payload.ts";
import { accepted, refused, type Result } from "../kernel/result.ts";
import { frameworkVersion, type FrameworkVersion, type KernelRefusal, type ProjectPath } from "../kernel/values.ts";

export type PhaseOnePackagingRequest = {
  readonly hasher: ContentHasher;
  readonly distribution: HostDistribution;
  readonly hostData: HostData;
  readonly projection: Projection;
  readonly channel: DistributionChannel;
};

export type OnboardingSource = {
  readonly host: Projection["host"];
  readonly files: readonly Pick<ProjectedFile, "path" | "origin">[];
};

export const onboardingPathOf = ({ host, files }: OnboardingSource): ProjectPath | undefined => {
  const rendered = files.filter((file) => file.origin.kind === "rendered" && file.origin.concept === "onboarding");
  return (rendered.find((file) => file.path.startsWith(`${host.directory}/`)) ?? rendered[0])?.path;
};

export type BuildPackaging = {
  readonly version: Result<FrameworkVersion, KernelRefusal | PackagingRefusal>;
  readonly stamp: VersionStamp;
  packageHost(request: PhaseOnePackagingRequest): Promise<Result<Payload, readonly (PackagingRefusal | KernelRefusal)[]>>;
};

const optionalOnboarding = (projection: OnboardingSource) => {
  const onboarding = onboardingPathOf(projection);
  return onboarding ? { onboarding } : {};
};

export const createBuildPackaging = (readVersion = readBuildVersion): BuildPackaging => {
  const captured = readVersion();
  const stamp = createVersionStamp(captured);
  const version = captured.ok ? frameworkVersion(captured.value) : captured;
  return { version, stamp,
    packageHost: async ({ hasher, distribution, hostData, projection, channel }) => {
      if (!version.ok) return refused([version.refusal]);
      return createPackagePayload({ hasher, stamp,
        layouts: { layout: () => accepted(distribution.layout) },
        history: { history: async () => accepted({ retiredFiles: [], priorIntegrations: distribution.priorIntegrations }) },
        bundler: { bundle: async () => accepted([]) },
        metadata: createLegacyPayloadMetadata({ hasher, distribution, hostData, ...optionalOnboarding(projection) }),
      }).package({ projection, channel, version: version.value, runtime: [] });
    } };
};
