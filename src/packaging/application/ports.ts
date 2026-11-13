import type { HostIdentity } from "../../kernel/host.ts";
import type { Projection } from "../../projection/domain/projection.ts";
import type { HostData } from "../../projection/domain/host-surface.ts";
import type { HostDistribution } from "../domain/payload.ts";
import type { FrameworkVersion, ProjectPath } from "../../kernel/values.ts";
import type { VersionStamp } from "./boundary-ports.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { Result } from "../../kernel/result.ts";
import type { ContentHash, DistributionId, KernelRefusal } from "../../kernel/values.ts";
import type { ArchiveFormat, PackagingRefusal, ReleaseArtifact } from "../domain/artifact.ts";
import type {
  Channel,
  Payload,
  PayloadFile,
  RuntimeEntryPoint,
} from "../domain/payload.ts";
import type { ReleaseHistory } from "../domain/release-history.ts";

export interface ReleaseHistorySource {
  history(distribution: DistributionId): Promise<Result<ReleaseHistory, PackagingRefusal>>;
}

export interface ToolBundler {
  bundle(request: {
    readonly entries: readonly RuntimeEntryPoint[];
    readonly host: HostIdentity;
    readonly channel: Channel;
  }): Promise<Result<readonly PayloadFile[], PackagingRefusal>>;
}

export interface ArtifactWriter {
  write(request: {
    readonly name: string;
    readonly format: ArchiveFormat;
    readonly payloads: readonly Payload[];
  }): Promise<Result<ReleaseArtifact, PackagingRefusal>>;
}

export interface ContentHasher {
  hash(content: FileContent): Result<ContentHash, KernelRefusal>;
}

export interface PayloadMetadata {
  files(releasePayload: Payload): Result<readonly PayloadFile[], readonly (PackagingRefusal | KernelRefusal)[]>;
}

export type PayloadMetadataRequest = {
  readonly hasher: ContentHasher;
  readonly distribution: HostDistribution;
  readonly hostData: HostData;
  readonly onboarding?: ProjectPath;
  readonly copy: Payload | null;
};

export interface PayloadMetadataFactory {
  forHost(request: PayloadMetadataRequest): PayloadMetadata;
}

export type HostPayloadRequest = {
  readonly hasher: ContentHasher;
  readonly distribution: HostDistribution;
  readonly hostData: HostData;
  readonly projection: Projection;
  readonly channel: Channel;
  readonly copy: Payload | null;
};

export interface BuildPackaging {
  readonly version: Result<FrameworkVersion, KernelRefusal | PackagingRefusal>;
  readonly stamp: VersionStamp;
  packageHost(request: HostPayloadRequest): Promise<Result<Payload, readonly (PackagingRefusal | KernelRefusal)[]>>;
}
