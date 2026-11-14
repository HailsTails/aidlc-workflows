import type { HostIdentity } from "../../kernel/host.ts";
import type { Projection, ProjectionRefusal } from "../../projection/domain/projection.ts";
import type { HostData } from "../../projection/domain/host-surface.ts";
import type { HostDistribution } from "../domain/payload.ts";
import type { FrameworkVersion, ProjectPath } from "../../kernel/values.ts";
import type { VersionStamp } from "./boundary-ports.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { Result } from "../../kernel/result.ts";
import type { ContentHash, DistributionId, KernelRefusal } from "../../kernel/values.ts";
import type { ArchiveFile, ArchiveFormat, PackagingRefusal } from "../domain/artifact.ts";
import type {
  Channel,
  Payload,
  PayloadFile,
  RuntimeEntryPoint,
} from "../domain/payload.ts";
import type { ReleaseHistory } from "../domain/release-history.ts";
import type { TreeFile } from "../../kernel/file-system-port.ts";

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
    readonly files: readonly ArchiveFile[];
  }): Promise<Result<ContentHash, PackagingRefusal>>;
}

export interface ContentHasher {
  hash(content: FileContent): Result<ContentHash, KernelRefusal>;
}

export interface PayloadMetadata {
  files(releasePayload: Payload): Result<readonly PayloadFile[], readonly (PackagingRefusal | KernelRefusal)[]>;
}

export type PayloadMetadataRequest = {
  readonly projection: Projection;
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

export interface CopyRuntimeOmissions {
  omitted(copyPayload: Payload): readonly ProjectPath[];
}

export interface PackagedSources {
  fingerprint(): Promise<Result<string, PackagingRefusal>>;
  forget(hosts: readonly DistributionId[]): Promise<Result<void, PackagingRefusal>>;
  record(request: {
    readonly hosts: readonly DistributionId[];
    readonly builtFrom: string;
  }): Promise<Result<"recorded" | "inputs-changed", PackagingRefusal>>;
  staleness(host: DistributionId): Promise<Result<string | null, PackagingRefusal>>;
}

export interface OutputTrees {
  readonly root: URL;
  list(folder: URL): Promise<Result<readonly string[], PackagingRefusal>>;
  remove(entry: URL): Promise<Result<URL, PackagingRefusal>>;
  writePayload(request: { readonly root: URL; readonly payload: Payload }): Promise<Result<URL, PackagingRefusal>>;
  scratch(): Promise<Result<URL, PackagingRefusal>>;
  read(folder: URL): Promise<Result<readonly TreeFile[], PackagingRefusal>>;
}

export type DistributionBuildFailure = KernelRefusal | ProjectionRefusal | PackagingRefusal;

export type DistributionPayloads = (request: {
  readonly host: HostIdentity;
  readonly channel: Channel;
  readonly projectRoot: URL;
  readonly copy: Payload | null;
}) => Promise<Result<Payload, readonly DistributionBuildFailure[]>>;

export interface DistributionPlugins {
  readonly directories: readonly string[];
  build(request: { readonly hosts: readonly HostIdentity[]; readonly output: URL; readonly boundary: URL }):
    Result<void, readonly DistributionBuildFailure[]>;
}

export type DistributionTargets = {
  readonly hosts: readonly HostIdentity[];
  readonly refusals: readonly PackagingRefusal[];
};

export interface PackageDistributions {
  build(request: DistributionTargets & { readonly sweep: "full" | "named" }):
    Promise<Result<{ readonly record: "recorded" | "inputs-changed" }, readonly DistributionBuildFailure[]>>;
  check(request: DistributionTargets): Promise<Result<{
    readonly problems: readonly string[];
    readonly inputs: "unchanged" | "inputs-changed";
  }, readonly DistributionBuildFailure[]>>;
}
