import { accepted, refused, type Result } from "../../kernel/result.ts";
import { frameworkVersion, type FrameworkVersion } from "../../kernel/values.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import type { Projection } from "../../projection/domain/projection.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { VersionStamp } from "./boundary-ports.ts";
import type { BuildPackaging, HostPayloadRequest, PayloadMetadataFactory, ReleaseHistorySource } from "./ports.ts";
import { createPackagePayload } from "./package-payload.ts";

export const selectOnboardingPath = ({ host, files }: {
  readonly host: Projection["host"];
  readonly files: readonly Pick<ProjectedFile, "path" | "origin">[];
}): ProjectPath | undefined => {
  const rendered = files.filter((file) => file.origin.kind === "rendered" && file.origin.concept === "onboarding");
  return (rendered.find((file) => file.path.startsWith(`${host.directory}/`)) ?? rendered[0])?.path;
};

const copyRefusal = (request: HostPayloadRequest, version: FrameworkVersion): PackagingRefusal | null => {
  if (request.copy === null) return null;
  if (request.channel === "copy") return { kind: "copy-payload-unexpected", host: request.projection.host };
  if (request.copy.channel !== "copy") return { kind: "copy-channel-mismatch", channel: request.copy.channel };
  if (request.copy.descriptor.host.distribution !== request.projection.host.distribution
    || request.copy.descriptor.host.directory !== request.projection.host.directory) {
    return { kind: "copy-host-mismatch", host: request.projection.host, copyHost: request.copy.descriptor.host };
  }
  return request.copy.version === version ? null
    : { kind: "mixed-versions", versions: [version, request.copy.version] };
};

export const createBuildPackagingUseCase = (ports: {
  readonly version: Result<string, PackagingRefusal>;
  readonly stamp: VersionStamp;
  readonly routes: NativeCommandRoutes;
  readonly history: ReleaseHistorySource;
  readonly metadata: PayloadMetadataFactory;
}): BuildPackaging => {
  const version = ports.version.ok ? frameworkVersion(ports.version.value) : ports.version;
  return { version, stamp: ports.stamp,
    packageHost: async (request) => {
      if (!version.ok) return refused([version.refusal]);
      const invalidCopy = copyRefusal(request, version.value);
      if (invalidCopy) return refused([invalidCopy]);
      const onboarding = selectOnboardingPath(request.projection);
      return createPackagePayload({ hasher: request.hasher, stamp: ports.stamp, routes: ports.routes,
        releases: { release: () => accepted(request.distribution.native) },
        layouts: { layout: () => accepted(request.distribution.layout) },
        history: { history: async (distribution) => {
          const history = await ports.history.history(distribution);
          return history.ok ? accepted({ ...history.value, priorIntegrations: request.distribution.priorIntegrations }) : history;
        } },
        bundler: { bundle: async () => accepted([]) },
        metadata: ports.metadata.forHost({ hasher: request.hasher, distribution: request.distribution,
          hostData: request.hostData, copy: request.copy, ...(onboarding ? { onboarding } : {}) }),
      }).package({ projection: request.projection, channel: request.channel, version: version.value, runtime: [] });
    } };
};
