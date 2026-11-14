import type { DistributionId, FrameworkVersion, ProjectPath } from "../../kernel/values.ts";
import type { PlannedContent } from "./file-operation.ts";

export type SiblingBlock =
  | {
      readonly kind: "shipped";
      readonly distribution: DistributionId;
      readonly version: FrameworkVersion;
      readonly block: PlannedContent;
    }
  | {
      readonly kind: "missing";
      readonly distribution: DistributionId;
      readonly expectedAt: ProjectPath;
    };
