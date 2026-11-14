import type { HostIdentity } from "../../kernel/host.ts";
import type { FileContent, FileMode } from "../../kernel/file-content.ts";
import type { FileSystemFault } from "../../kernel/file-system-port.ts";
import type { Brand } from "../../kernel/brand.ts";
import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  KernelRefusal,
  ProjectPath,
} from "../../kernel/values.ts";
import type { ProjectionOrigin } from "../../projection/domain/projected-file.ts";
import type { Channel } from "./payload.ts";

export type ArchiveFormat = "tar.gz";

export type ArchiveEntry = Brand<string, "ArchiveEntry">;

export type ArchiveFile = {
  readonly entry: ArchiveEntry;
  readonly content: FileContent;
  readonly mode: FileMode;
};

export type ReleaseArtifact = {
  readonly name: string;
  readonly format: ArchiveFormat;
  readonly version: FrameworkVersion;
  readonly channel: Channel;
  readonly distributions: readonly DistributionId[];
  readonly digest: ContentHash;
  readonly entries: readonly ArchiveEntry[];
};

export type PackagingRefusal =
  | { readonly kind: "copy-payload-unexpected"; readonly host: HostIdentity }
  | { readonly kind: "copy-channel-mismatch"; readonly channel: Channel }
  | { readonly kind: "copy-host-mismatch"; readonly host: HostIdentity; readonly copyHost: HostIdentity }
  | { readonly kind: "release-history-unreadable"; readonly distribution: DistributionId; readonly reason: string }
  | { readonly kind: "native-text-not-found"; readonly distribution: DistributionId; readonly text: string }
  | { readonly kind: "native-leftover"; readonly path: ProjectPath; readonly reason: string }
  | { readonly kind: "no-payloads" }
  | { readonly kind: "mixed-channels"; readonly channels: readonly [Channel, Channel] }
  | { readonly kind: "plugin-tree-unreadable"; readonly within: string; readonly code: FileSystemFault | "unportable-name" }
  | { readonly kind: "packaged-sources-failed"; readonly operation: "read-inputs" | "hash-inputs" | "write-record";
      readonly path: string; readonly reason: string }
  | { readonly kind: "listing-text-not-plain"; readonly distribution: DistributionId }
  | { readonly kind: "root-integration-duplicate"; readonly path: ProjectPath }
  | { readonly kind: "root-integration-missing"; readonly path: ProjectPath }
  | { readonly kind: "shared-root-integration-differs"; readonly path: ProjectPath;
      readonly distributions: readonly [DistributionId, DistributionId] }
  | { readonly kind: "projection-refused"; readonly distribution: DistributionId }
  | { readonly kind: "unknown-distribution"; readonly distribution: DistributionId }
  | { readonly kind: "duplicate-path"; readonly path: ProjectPath }
  | {
      readonly kind: "path-undeclared";
      readonly path: ProjectPath;
      readonly origin: ProjectionOrigin;
    }
  | { readonly kind: "entry-not-bundled"; readonly entry: string; readonly reason: string }
  | { readonly kind: "version-module-count"; readonly found: number }
  | { readonly kind: "version-unstampable"; readonly reason: string }
  | {
      readonly kind: "mixed-versions";
      readonly versions: readonly [FrameworkVersion, FrameworkVersion];
    }
  | {
      readonly kind: "duplicate-payload";
      readonly distribution: DistributionId;
      readonly channel: Channel;
    }
  | { readonly kind: "archive-not-written"; readonly name: string; readonly reason: string }
  | { readonly kind: "output-tree-failed"; readonly operation: "list" | "remove" | "write" | "scratch" | "read";
      readonly path: string; readonly reason: string }
  | { readonly kind: "host-build-refused"; readonly reason: KernelRefusal };
