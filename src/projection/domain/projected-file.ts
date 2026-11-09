import type { FileContent, FileMode } from "../../kernel/file-content.ts";
import type { ProjectPath, SourcePath } from "../../kernel/values.ts";
import type { MethodSourcePath } from "../../workflow-definition/domain/method-source.ts";

export const RENDERED_CONCEPTS = [
  "agent",
  "stage-command",
  "scope-command",
  "session-skill",
  "orchestrator-skill",
  "settings",
  "hook-registration",
  "onboarding",
  "neutral-document",
  "host-data",
] as const;

export type RenderedConcept = (typeof RENDERED_CONCEPTS)[number];

export type RuntimeDataName = "agent-tiers" | "settings-schema";

export type ProjectionOrigin =
  | { readonly kind: "method-source"; readonly path: MethodSourcePath }
  | { readonly kind: "neutral"; readonly source: SourcePath }
  | { readonly kind: "harness-authored"; readonly source: SourcePath }
  | { readonly kind: "rendered"; readonly concept: RenderedConcept; readonly name: string }
  | { readonly kind: "runtime-data"; readonly name: RuntimeDataName };

export type DistributionChannel = "copy" | "native";

export type Availability = "always" | `${DistributionChannel}-only`;

export type ProjectedFile = {
  readonly path: ProjectPath;
  readonly content: FileContent;
  readonly mode: FileMode;
  readonly origin: ProjectionOrigin;
  readonly availability: Availability;
};
