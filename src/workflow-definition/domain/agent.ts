import type { AgentSlug, Owner } from "./identities.ts";
import type { Tier } from "./vocabulary.ts";

export type ToolPolicy = {
  readonly disallowed: readonly string[];
};

export type Agent = {
  readonly slug: AgentSlug;
  readonly displayName: string;
  readonly description: string;
  readonly owner: Owner;
  readonly tier: Tier | null;
  readonly examples: readonly string[];
  readonly tools: ToolPolicy;
  readonly maxTurns: number | null;
  readonly persona: string;
};
