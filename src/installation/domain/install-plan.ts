import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  NonEmptyArray,
  RelativePath,
} from "../../kernel/values.ts";
import type { Payload, PayloadFile } from "../../packaging/domain/payload.ts";
import type { RootIntegration } from "../../projection/domain/root-integration.ts";
import type { FileOperation } from "./file-operation.ts";
import type { OwnershipRecord, RootContribution } from "./ownership.ts";

export type InstallMode =
  | { readonly kind: "fresh" }
  | { readonly kind: "refresh"; readonly force: boolean }
  | { readonly kind: "remove" };

export type FileChange = "content" | "executable" | "content-and-executable";

export type ManagedFileDecision =
  | { readonly kind: "create"; readonly file: PayloadFile }
  | {
      readonly kind: "update";
      readonly file: PayloadFile;
      readonly replaces: ContentHash;
      readonly change: FileChange;
    }
  | { readonly kind: "unchanged"; readonly path: RelativePath }
  | { readonly kind: "preserve"; readonly path: RelativePath; readonly projectHash: ContentHash }
  | { readonly kind: "retire"; readonly path: RelativePath; readonly expected: ContentHash };

export type RootIntegrationDecision =
  | {
      readonly kind: "create" | "merge";
      readonly integration: RootIntegration;
      readonly contribution: RootContribution;
    }
  | { readonly kind: "unchanged"; readonly integration: RootIntegration }
  | { readonly kind: "retire"; readonly contribution: RootContribution };

export type ConflictCause =
  | {
      readonly kind: "edited";
      readonly recorded: ContentHash | null;
      readonly current: ContentHash;
      readonly retiring: boolean;
    }
  | { readonly kind: "not-a-regular-file"; readonly retiring: boolean }
  | { readonly kind: "missing-sibling-block"; readonly sibling: DistributionId }
  | { readonly kind: "malformed"; readonly issue: string }
  | {
      readonly kind: "owned-by-sibling";
      readonly owner: DistributionId;
      readonly sameRelease: boolean;
    }
  | { readonly kind: "unowned-whole-file" };

export type InstallConflict = {
  readonly path: RelativePath;
  readonly cause: ConflictCause;
};

export type InstallNote = {
  readonly path: RelativePath | null;
  readonly line: string;
};

type PlanBasis = {
  readonly payload: Payload;
  readonly mode: InstallMode;
  readonly installedVersion: FrameworkVersion | null;
  readonly files: readonly ManagedFileDecision[];
  readonly rootIntegrations: readonly RootIntegrationDecision[];
  readonly notes: readonly InstallNote[];
};

export type ReadyInstallPlan = PlanBasis & {
  readonly kind: "ready";
  readonly ownershipAfter: OwnershipRecord;
  readonly operations: readonly FileOperation[];
};

export type BlockedInstallPlan = PlanBasis & {
  readonly kind: "blocked";
  readonly conflicts: NonEmptyArray<InstallConflict>;
};

export type InstallPlan = ReadyInstallPlan | BlockedInstallPlan;
