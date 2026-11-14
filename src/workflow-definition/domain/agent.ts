import type { AgentSlug, PluginId } from "./identities.ts";
import type { MethodSourcePath } from "./method-source.ts";
import type { AuthoredBody } from "./outline.ts";
import type { Tier } from "./vocabulary.ts";

export type ToolPolicy = {
  readonly disallowed: readonly string[];
};

export type TieredModel = { readonly kind: "tier"; readonly tier: Tier };

export type ModelChoice = TieredModel | { readonly kind: "host-default" };

export type PersonaAdditions = {
  readonly afterPreflight: readonly string[];
  readonly endOfBody: readonly string[];
};

type AgentBase = {
  readonly slug: AgentSlug;
  readonly source: MethodSourcePath;
  readonly displayName: string;
  readonly description: string;
  readonly examples: readonly string[];
  readonly tools: ToolPolicy;
  readonly maxTurns: number | null;
  readonly persona: AuthoredBody;
  readonly additions: PersonaAdditions;
};

export type CoreAgent = AgentBase & {
  readonly owner: { readonly kind: "core" };
  readonly model: TieredModel;
};

export type PluginAgent = AgentBase & {
  readonly owner: { readonly kind: "plugin"; readonly plugin: PluginId };
  readonly model: ModelChoice;
};

export type Agent = CoreAgent | PluginAgent;
