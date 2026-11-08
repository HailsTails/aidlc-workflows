import type { AgentSlug, PluginId, ScopeName, SensorId, StageSlug } from "./identities.ts";
import type { MethodContent } from "./method.ts";
import type { ArtifactConsumption, ArtifactProduction } from "./stage.ts";

export type OverlayAnchor =
  | { readonly kind: "after-step"; readonly step: number }
  | { readonly kind: "before-step"; readonly step: number }
  | { readonly kind: "end-of-steps" }
  | { readonly kind: "in-section"; readonly section: string }
  | { readonly kind: "after-preflight" }
  | { readonly kind: "end-of-body" };

export type OverlayFragment = {
  readonly anchor: OverlayAnchor;
  readonly order: number;
  readonly text: string;
};

export type StageAdditions = {
  readonly produces: readonly ArtifactProduction[];
  readonly consumes: readonly ArtifactConsumption[];
  readonly sensors: readonly SensorId[];
  readonly scopes: readonly ScopeName[];
  readonly requires: readonly StageSlug[];
  readonly requiredSections: readonly string[];
};

export type OverlayTarget =
  | { readonly kind: "stage"; readonly stage: StageSlug; readonly adds: StageAdditions }
  | { readonly kind: "agent"; readonly agent: AgentSlug };

export type Overlay = {
  readonly target: OverlayTarget;
  readonly fragments: readonly OverlayFragment[];
};

export type ContributionDependency =
  | { readonly kind: "core" }
  | { readonly kind: "plugin"; readonly plugin: PluginId };

export type Contribution = {
  readonly plugin: PluginId;
  readonly version: string;
  readonly description: string;
  readonly dependsOn: readonly ContributionDependency[];
  readonly content: MethodContent;
  readonly overlays: readonly Overlay[];
};
