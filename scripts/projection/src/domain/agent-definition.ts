import type { HarnessBinding, Harness } from "./harness-binding.ts";
import type { SourceOrigin, SourceBasis } from "./source-origin.ts";
import type { AgentStageMode } from "./stage-participation.ts";
import type { NativeTier, Tier } from "./model.ts";
import type { NativeResource } from "./native-rendering.ts";

export type AgentOrigin = SourceOrigin;
export type AgentModelChoice =
  | { readonly kind: "tier"; readonly tier: Tier }
  | { readonly kind: "explicit"; readonly model: string };
export type AgentTool = "Read" | "Grep" | "Glob" | "Bash" | "Write" | "Edit";
export type AgentExecutionPolicy = {
  readonly tools: { readonly kind: "inherit" } | { readonly kind: "allow"; readonly names: readonly AgentTool[] };
  readonly turnLimit: number | null;
  readonly ambientInstructions: "inherit" | "omit-claude-md";
};
export type AuthoredAgent = {
  readonly origin: AgentOrigin;
  readonly name: string;
  readonly description: string;
  readonly examples: readonly string[];
  readonly model: AgentModelChoice;
  readonly delegation: "leaf";
  readonly policy: AgentExecutionPolicy;
  readonly frontmatter: string;
  readonly body: string;
};
export type AgentKnowledge = {
  readonly origin: AgentOrigin;
  readonly body: string;
};
export type AuthoredAgentStage = {
  readonly origin: AgentOrigin;
  readonly slug: string;
  readonly mode: AgentStageMode;
  readonly lead: string;
  readonly supports: readonly string[];
  readonly reviewer: string | null;
};
export type CompiledStageOrigin = { readonly kind: "compiled"; readonly artifact: SourceOrigin; readonly definition: SourceBasis };
export type CompiledAgentStage = Omit<AuthoredAgentStage, "origin"> & { readonly origin: CompiledStageOrigin };
export type AgentStage = AuthoredAgentStage | CompiledAgentStage;
export type AgentParticipation = {
  readonly origin: AgentStage["origin"];
  readonly stage: string;
  readonly mode: AgentStage["mode"];
  readonly role: "lead" | "support" | "reviewer";
};
export type AgentHarnessBinding = HarnessBinding;
export type AgentHarness = Harness;
export type AgentContext = AgentHarnessBinding & {
  readonly turnLimitProjection?: "authored-metadata";
  readonly invocation: string;
  readonly tierCap: Tier;
  readonly sharedKnowledge: "all" | "methodology-only";
  readonly rulesSubdir: "rules" | "aidlc-rules" | "steering";
  readonly knowledgeRead: "ordinary" | "kiro-chunks";
  readonly models: {
    readonly tiers: Readonly<Record<Tier, NativeTier>>;
    readonly explicit: "preserve" | "inherit";
  };
  readonly memoryReference: "aidlc/active-memory" | "aidlc/spaces/default/memory" | null;
};
export type PreparedAgent = {
  readonly personaBody: string;
  readonly agent: AuthoredAgent;
  readonly context: AgentContext;
  readonly nativeModel: NativeTier;
  readonly knowledge: readonly AgentKnowledge[];
  readonly participation: readonly AgentParticipation[];
};
export type AgentProjection = {
  readonly dependencies?: readonly SourceOrigin[];
  readonly origin: AgentOrigin;
  readonly harness: AgentHarness;
  readonly resources: readonly NativeResource[];
  readonly participation: readonly AgentParticipation[];
};
