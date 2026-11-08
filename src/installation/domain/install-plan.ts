import type { ContentHash, FrameworkVersion, RelativePath } from "../../kernel/values.ts";
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
  | {
      readonly kind: "conflict";
      readonly file: PayloadFile;
      readonly recorded: ContentHash;
      readonly current: ContentHash;
    }
  | { readonly kind: "retire"; readonly path: RelativePath; readonly expected: ContentHash };

export type RootIntegrationDecision =
  | {
      readonly kind: "create" | "merge";
      readonly integration: RootIntegration;
      readonly contribution: RootContribution;
    }
  | { readonly kind: "unchanged"; readonly integration: RootIntegration }
  | {
      readonly kind: "conflict";
      readonly integration: RootIntegration;
      readonly reason: string;
    }
  | { readonly kind: "retire"; readonly contribution: RootContribution };

export type InstallNote = {
  readonly path: RelativePath | null;
  readonly line: string;
};

export type InstallPlan = {
  readonly payload: Payload;
  readonly mode: InstallMode;
  readonly installedVersion: FrameworkVersion | null;
  readonly files: readonly ManagedFileDecision[];
  readonly rootIntegrations: readonly RootIntegrationDecision[];
  readonly ownershipAfter: OwnershipRecord;
  readonly operations: readonly FileOperation[];
  readonly notes: readonly InstallNote[];
};
