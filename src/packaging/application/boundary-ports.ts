import type { Result } from "../../kernel/result.ts";
import type { DistributionId } from "../../kernel/values.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { DistributionLayout } from "../domain/payload.ts";

export interface DistributionLayouts {
  layout(distribution: DistributionId): Result<DistributionLayout, PackagingRefusal>;
}
