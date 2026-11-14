import type { FileContent } from "../../kernel/file-content.ts";
import type { Result } from "../../kernel/result.ts";
import type { DistributionId } from "../../kernel/values.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { DistributionLayout, NativeRelease } from "../domain/payload.ts";

export interface DistributionLayouts {
  layout(distribution: DistributionId): Result<DistributionLayout, PackagingRefusal>;
}

export interface NativeReleases {
  release(distribution: DistributionId): Result<NativeRelease, PackagingRefusal>;
}

export type VersionStamp = (module: FileContent) => Result<FileContent, PackagingRefusal>;
