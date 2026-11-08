import type { DistributionId, FrameworkVersion, RelativePath } from "../../kernel/values.ts";

export type InstallRefusal =
  | { readonly kind: "local-edits"; readonly paths: readonly RelativePath[] }
  | {
      readonly kind: "occupied-by-other-distribution";
      readonly harnessDirectory: RelativePath;
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
      readonly path: RelativePath;
      readonly issues: readonly string[];
    }
  | { readonly kind: "path-is-link"; readonly path: RelativePath }
  | { readonly kind: "changed-since-planned"; readonly path: RelativePath };
