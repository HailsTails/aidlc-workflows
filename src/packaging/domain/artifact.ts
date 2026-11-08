import type { Brand } from "../../kernel/brand.ts";
import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  ProjectPath,
} from "../../kernel/values.ts";
import type { ProjectionOrigin } from "../../projection/domain/projected-file.ts";
import type { Channel } from "./payload.ts";

export type ArchiveFormat = "tar.gz" | "zip";

export type ArchiveEntry = Brand<string, "ArchiveEntry">;

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
  | { readonly kind: "projection-refused"; readonly distribution: DistributionId }
  | { readonly kind: "unknown-distribution"; readonly distribution: DistributionId }
  | { readonly kind: "duplicate-path"; readonly path: ProjectPath }
  | {
      readonly kind: "path-undeclared";
      readonly path: ProjectPath;
      readonly origin: ProjectionOrigin;
    }
  | { readonly kind: "entry-not-bundled"; readonly entry: string; readonly reason: string }
  | {
      readonly kind: "mixed-versions";
      readonly versions: readonly [FrameworkVersion, FrameworkVersion];
    }
  | {
      readonly kind: "duplicate-payload";
      readonly distribution: DistributionId;
      readonly channel: Channel;
    }
  | { readonly kind: "archive-not-written"; readonly name: string; readonly reason: string };
