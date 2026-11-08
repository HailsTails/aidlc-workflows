import type { Result } from "../../kernel/result.ts";
import type { FrameworkVersion } from "../../kernel/values.ts";
import type { Projection } from "../../projection/domain/projection.ts";
import type { ArchiveFormat, PackagingRefusal, ReleaseArtifact } from "../domain/artifact.ts";
import type { Layout, Payload, RetiredFile, RuntimeEntryPoint } from "../domain/payload.ts";

export type PackagePayloadRequest = {
  readonly projection: Projection;
  readonly layout: Layout;
  readonly version: FrameworkVersion;
  readonly runtime: readonly RuntimeEntryPoint[];
  readonly retired: readonly RetiredFile[];
};

export interface PackagePayload {
  package(request: PackagePayloadRequest): Promise<Result<Payload, readonly PackagingRefusal[]>>;
}

export interface BuildReleaseArtifact {
  build(request: {
    readonly name: string;
    readonly format: ArchiveFormat;
    readonly payloads: readonly Payload[];
  }): Promise<Result<ReleaseArtifact, PackagingRefusal>>;
}
