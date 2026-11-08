import type { Result } from "../../kernel/result.ts";
import type { FrameworkVersion } from "../../kernel/values.ts";
import type { Projection } from "../../projection/domain/projection.ts";
import type { ArchiveFormat, PackagingRefusal, ReleaseArtifact } from "../domain/artifact.ts";
import type { Channel, Payload, RuntimeEntryPoint } from "../domain/payload.ts";

export type PackagePayloadRequest = {
  readonly projection: Projection;
  readonly channel: Channel;
  readonly version: FrameworkVersion;
  readonly runtime: readonly RuntimeEntryPoint[];
};

export interface PackagePayload {
  package(request: PackagePayloadRequest): Promise<Result<Payload, readonly PackagingRefusal[]>>;
}

export type BuildReleaseArtifactRequest = {
  readonly name: string;
  readonly format: ArchiveFormat;
  readonly payloads: readonly Payload[];
};

export interface BuildReleaseArtifact {
  build(
    request: BuildReleaseArtifactRequest,
  ): Promise<Result<ReleaseArtifact, readonly PackagingRefusal[]>>;
}
