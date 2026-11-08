import type { SourcePath } from "../../kernel/values.ts";
import type { AgentSlug, PluginId, ScopeName, SensorId, StageSlug } from "./identities.ts";
import type { MethodContent } from "./method.ts";
import type { ArtifactConsumption, ArtifactProduction } from "./stage.ts";

export type StageAnchor =
  | { readonly kind: "after-step"; readonly step: number }
  | { readonly kind: "before-step"; readonly step: number }
  | { readonly kind: "end-of-steps" }
  | { readonly kind: "in-section"; readonly section: string };

export type PersonaAnchor = { readonly kind: "after-preflight" } | { readonly kind: "end-of-body" };

export type OverlayAnchor = StageAnchor | PersonaAnchor;

export type OverlayFragment<Anchor extends OverlayAnchor> = {
  readonly anchor: Anchor;
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

export type Overlay =
  | {
      readonly kind: "stage";
      readonly stage: StageSlug;
      readonly adds: StageAdditions;
      readonly fragments: readonly OverlayFragment<StageAnchor>[];
    }
  | {
      readonly kind: "agent";
      readonly agent: AgentSlug;
      readonly fragments: readonly OverlayFragment<PersonaAnchor>[];
    };

export type OverlayTarget = Overlay["kind"];

export type ContributionDependency =
  | { readonly kind: "core" }
  | { readonly kind: "plugin"; readonly plugin: PluginId };

export const RULE_LEVELS = ["org", "team", "project"] as const;

export type RuleLevel = (typeof RULE_LEVELS)[number];

export type PluginCommand = {
  readonly name: string;
  readonly script: SourcePath;
  readonly description: string;
};

export type PluginTools = {
  readonly scripts: readonly SourcePath[];
  readonly doctorCheck: SourcePath | null;
  readonly commands: readonly PluginCommand[];
};

export type Contribution = {
  readonly plugin: PluginId;
  readonly version: string;
  readonly description: string;
  readonly dependsOn: readonly ContributionDependency[];
  readonly rulesLevel: RuleLevel;
  readonly content: MethodContent;
  readonly overlays: readonly Overlay[];
  readonly tools: PluginTools;
};
