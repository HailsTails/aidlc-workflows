import type { DistributionId, RelativePath } from "../../kernel/values.ts";
import type { VersionStamp } from "../../packaging/domain/payload.ts";
import type { FileContent } from "../../projection/domain/projected-file.ts";
import type { RootIntegration } from "../../projection/domain/root-integration.ts";

export type SiblingBlock =
  | {
      readonly kind: "shipped";
      readonly distribution: DistributionId;
      readonly stamp: VersionStamp;
      readonly integration: RootIntegration;
      readonly content: FileContent;
    }
  | {
      readonly kind: "missing";
      readonly distribution: DistributionId;
      readonly expectedAt: RelativePath;
    };
