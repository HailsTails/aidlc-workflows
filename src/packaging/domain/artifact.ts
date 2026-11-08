import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  RelativePath,
} from "../../kernel/values.ts";
import type { Layout } from "./payload.ts";

export type ArchiveFormat = "tar.gz" | "zip";

export type ReleaseArtifact = {
  readonly name: string;
  readonly format: ArchiveFormat;
  readonly version: FrameworkVersion;
  readonly layout: Layout;
  readonly distributions: readonly DistributionId[];
  readonly digest: ContentHash;
  readonly entries: readonly RelativePath[];
};

export type PackagingRefusal =
  | { readonly kind: "projection-refused"; readonly distribution: DistributionId }
  | { readonly kind: "duplicate-path"; readonly path: RelativePath }
  | { readonly kind: "entry-not-bundled"; readonly entry: string; readonly reason: string }
  | { readonly kind: "archive-not-written"; readonly name: string; readonly reason: string };
