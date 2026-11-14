import type { DistributionId, FrameworkVersion, ProjectPath } from "../../kernel/values.ts";

export type InstallRefusal =
  | {
      readonly kind: "occupied-by-other-distribution";
      readonly harnessDirectory: ProjectPath;
      readonly occupant: DistributionId;
    }
  | {
      readonly kind: "downgrade";
      readonly installed: FrameworkVersion;
      readonly incoming: FrameworkVersion;
    }
  | { readonly kind: "transaction-pending"; readonly startedAt: string }
  | {
      readonly kind: "unreadable-ownership-record";
      readonly path: ProjectPath;
      readonly issues: readonly string[];
    }
  | { readonly kind: "path-is-link"; readonly path: ProjectPath }
  | { readonly kind: "changed-since-planned"; readonly path: ProjectPath };
