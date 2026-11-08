import type { Brand } from "../../kernel/brand.ts";
import type { Agent } from "./agent.ts";
import type { MethodFinding } from "./findings.ts";
import type { HookDeclaration } from "./hooks.ts";
import type { PluginId, ScopeName } from "./identities.ts";
import type { KnowledgeDocument } from "./knowledge.ts";
import type { Rule } from "./rule.ts";
import type { FreeformDefaultClaim, Scope, ScopeMembership } from "./scope.ts";
import type { SensorDeclaration } from "./sensor.ts";
import type { Stage } from "./stage.ts";
import type { StageGraph } from "./stage-graph.ts";

export type ContributedContent = {
  readonly stages: readonly Stage[];
  readonly scopes: readonly Scope[];
  readonly memberships: readonly ScopeMembership[];
  readonly freeformDefaults: readonly FreeformDefaultClaim[];
  readonly agents: readonly Agent[];
  readonly rules: readonly Rule[];
  readonly sensors: readonly SensorDeclaration[];
  readonly knowledge: readonly KnowledgeDocument[];
};

export type CoreContent = ContributedContent & {
  readonly hooks: readonly HookDeclaration[];
};

export type PluginSelection =
  | { readonly kind: "every-installed" }
  | {
      readonly kind: "only";
      readonly core: boolean;
      readonly plugins: readonly PluginId[];
    };

export type CompiledMethod = {
  readonly stages: readonly Stage[];
  readonly scopes: readonly Scope[];
  readonly memberships: readonly ScopeMembership[];
  readonly freeformDefault: ScopeName | null;
  readonly agents: readonly Agent[];
  readonly rules: readonly Rule[];
  readonly sensors: readonly SensorDeclaration[];
  readonly knowledge: readonly KnowledgeDocument[];
  readonly hooks: readonly HookDeclaration[];
  readonly installedPlugins: readonly PluginId[];
  readonly selection: PluginSelection;
  readonly graph: StageGraph;
  readonly findings: readonly MethodFinding[];
};

export type Method = Brand<CompiledMethod, "Method">;
