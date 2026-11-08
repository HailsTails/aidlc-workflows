import type { Agent } from "./agent.ts";
import type { MethodFinding } from "./findings.ts";
import type { PluginId } from "./identities.ts";
import type { KnowledgeDocument } from "./knowledge.ts";
import type { Rule } from "./rule.ts";
import type { Scope } from "./scope.ts";
import type { SensorDeclaration } from "./sensor.ts";
import type { Stage } from "./stage.ts";
import type { StageGraph } from "./stage-graph.ts";

export type MethodContent = {
  readonly stages: readonly Stage[];
  readonly scopes: readonly Scope[];
  readonly agents: readonly Agent[];
  readonly rules: readonly Rule[];
  readonly sensors: readonly SensorDeclaration[];
  readonly knowledge: readonly KnowledgeDocument[];
};

export type PluginSelection =
  | { readonly kind: "every-installed" }
  | { readonly kind: "only"; readonly plugins: readonly PluginId[] };

export type Method = {
  readonly content: MethodContent;
  readonly installedPlugins: readonly PluginId[];
  readonly selection: PluginSelection;
  readonly graph: StageGraph;
  readonly findings: readonly MethodFinding[];
};
