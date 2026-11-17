import type {
  ContentHash,
  DistributionId,
  FrameworkVersion,
  NonEmptyArray,
  ProjectPath,
} from "../../kernel/values.ts";
import type { Payload, PayloadFile } from "../../packaging/domain/payload.ts";
import type { RootIntegration } from "../../packaging/domain/root-integration.ts";
import type { ExpectedState, PlannedContent } from "./file-operation.ts";
import type { McpChoice, RootContribution } from "./ownership.ts";

export type InstallMode =
  | { readonly kind: "fresh" }
  | { readonly kind: "refresh"; readonly edits: "refuse" | "overwrite" }
  | { readonly kind: "remove" };

export type IntegrationLifecycle = "live" | "retiring";

export type FileChange = "content" | "executable" | "content-and-executable";

export type ManagedFileDecision =
  | { readonly kind: "create"; readonly file: PayloadFile }
  | {
      readonly kind: "update";
      readonly file: PayloadFile;
      readonly replaces: ContentHash;
      readonly change: FileChange;
    }
  | { readonly kind: "unchanged"; readonly path: ProjectPath }
  | { readonly kind: "preserve"; readonly path: ProjectPath; readonly projectHash: ContentHash }
  | { readonly kind: "retire"; readonly path: ProjectPath; readonly expected: ContentHash };

export type RootIntegrationDecision =
  | {
      readonly kind: "create" | "merge";
      readonly integration: RootIntegration;
      readonly before: ExpectedState;
      readonly next: PlannedContent;
      readonly contribution: RootContribution;
    }
  | { readonly kind: "unchanged"; readonly integration: RootIntegration }
  | {
      readonly kind: "retire";
      readonly contribution: RootContribution;
      readonly before: ExpectedState;
      readonly next: PlannedContent | null;
    };

export type JsonShape = "object" | "array" | "string-array";

export type MalformedContent =
  | { readonly kind: "not-utf8" }
  | { readonly kind: "json-syntax" }
  | { readonly kind: "json-root-not-object" }
  | { readonly kind: "json-key-shape"; readonly key: string; readonly expected: JsonShape }
  | { readonly kind: "block-markers" };

export type ConflictCause =
  | {
      readonly kind: "edited";
      readonly recorded: ContentHash;
      readonly current: ContentHash;
      readonly lifecycle: IntegrationLifecycle;
    }
  | { readonly kind: "unowned-edit"; readonly current: ContentHash }
  | { readonly kind: "not-a-regular-file"; readonly lifecycle: IntegrationLifecycle }
  | {
      readonly kind: "missing-sibling-block";
      readonly sibling: DistributionId;
      readonly expectedAt: ProjectPath;
    }
  | {
      readonly kind: "malformed";
      readonly side: "project" | "shipped";
      readonly problem: MalformedContent;
    }
  | { readonly kind: "owned-by-sibling-of-other-release"; readonly owner: DistributionId }
  | { readonly kind: "unowned-whole-file" };

export type InstallConflict = {
  readonly path: ProjectPath;
  readonly cause: ConflictCause;
};

export type InstallNote = {
  readonly path: ProjectPath | null;
  readonly line: string;
};

type PlanBasis = {
  readonly payload: Payload;
  readonly mode: InstallMode;
  readonly installedVersion: FrameworkVersion | null;
  readonly mcp: McpChoice;
  readonly files: readonly ManagedFileDecision[];
  readonly rootIntegrations: readonly RootIntegrationDecision[];
  readonly notes: readonly InstallNote[];
};

export type ReadyInstallPlan = PlanBasis & {
  readonly kind: "ready";
  readonly recordBefore: ExpectedState;
};

export type BlockedInstallPlan = PlanBasis & {
  readonly kind: "blocked";
  readonly conflicts: NonEmptyArray<InstallConflict>;
};

export type InstallPlan = ReadyInstallPlan | BlockedInstallPlan;
