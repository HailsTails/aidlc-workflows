import type { HostIdentity } from "../../kernel/host.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { scopeColumn } from "../../workflow-definition/domain/scope-grid.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import type { StageNode } from "../../workflow-definition/domain/stage-graph.ts";

type Field = readonly [string, unknown];
type RenderingRequest = { readonly method: Method; readonly host: HostIdentity;
  readonly memoryRoot: ProjectPath };

const optional = (name: string, definition: unknown): readonly Field[] =>
  definition === undefined ? [] : [[name, definition]];

const productionFields = (stage: Stage): readonly Field[] => {
  const required = stage.produces.filter((production) => production.obligation === "required")
    .map((production) => production.artifact);
  const additional = stage.produces.filter((production) => production.obligation === "optional")
    .map((production) => production.artifact);
  const kinds = stage.produces.filter((production) => production.unitKinds !== "all")
    .map((production) => [production.artifact, production.unitKinds]);
  return [["produces", required],
    ...optional("optional_produces", additional.length > 0 ? additional : undefined),
    ...optional("produces_kinds", kinds.length > 0 ? Object.fromEntries(kinds) : undefined)];
};

const consumptionFields = (stage: Stage): readonly Field[] => {
  const consumes = stage.consumes.map((consumption) => Object.fromEntries([
    ["artifact", consumption.artifact], ["required", consumption.obligation === "required"],
    ...optional("conditional_on", consumption.when === "always" ? undefined : consumption.when),
  ]));
  const citations = stage.consumes.filter((consumption) => consumption.citation === "cited")
    .map((consumption) => consumption.artifact);
  return [["consumes", consumes], ...optional("cites", citations.length > 0 ? citations : undefined)];
};

const reviewerFields = (stage: Stage): readonly Field[] => stage.review ? [
  ["reviewer", stage.review.reviewer], ["review_artifact", stage.review.artifact],
  ["reviewer_max_iterations", stage.review.maxIterations], ["review_class", stage.review.reviewClass],
] : [];

const priorFields = (stage: Stage): readonly Field[] => {
  const prior = stage.composerPrior;
  if (!prior) return [];
  return [["ars", Object.fromEntries([
    ["targets", prior.targets], ["cost", prior.cost], ...optional("role", prior.role ?? undefined),
    ...optional("project_types", prior.projectTypes.length > 0 ? prior.projectTypes : undefined),
  ])]];
};

const resolvedRules = (request: RenderingRequest, node: StageNode): readonly object[] =>
  node.rulesInContext.flatMap((identity) => {
    const rule = request.method.rules.find((candidate) => candidate.id === identity);
    return rule ? [{ path: `${request.memoryRoot}/${identity}.md`, scope: rule.layer.kind }] : [];
  });

const resolvedSensors = (request: RenderingRequest, node: StageNode): readonly object[] =>
  node.activeSensors.flatMap((identity) => {
    const sensor = request.method.sensors.find((candidate) => candidate.id === identity);
    return sensor ? [Object.fromEntries([
      ["id", sensor.id], ["path", `${request.host.directory}/${sensor.source}`],
      ["fire_on", sensor.firesOn], ["default_severity", sensor.severity],
      ...optional("category", sensor.category ?? undefined),
      ...optional("matches", sensor.matches ?? undefined),
    ])] : [];
  });

const stageFields = (request: RenderingRequest, node: StageNode): readonly Field[] => {
  const stage = request.method.stages.find((candidate) => candidate.slug === node.stage);
  if (!stage) throw new Error(`The compiled graph references missing stage ${node.stage}`);
  return [
    ["slug", stage.slug], ["number", node.number], ["name", stage.displayName],
    ...optional("plugin", stage.owner.kind === "plugin" ? stage.owner.plugin : undefined),
    ...optional("enabled", node.availability === "disabled" ? false : undefined),
    ["phase", stage.phase], ["execution", stage.execution.trigger.toUpperCase()],
    ["condition", stage.execution.condition],
    ["lead_agent", stage.participation.lead.kind === "conductor"
      ? "orchestrator" : stage.participation.lead.agent],
    ["support_agents", stage.participation.supports], ["mode", stage.participation.mode],
    ...optional("for_each", stage.cardinality.kind === "per-unit" ? "unit-of-work" : undefined),
    ...optional("workspace_requires", stage.workspace === "writes" ? true : undefined),
    ...productionFields(stage), ...consumptionFields(stage),
    ["requires_stage", [...new Set(stage.requires)]], ["sensors", stage.sensors],
    ["scopes", request.method.memberships.filter((membership) => membership.stage === stage.slug)
      .map((membership) => membership.scope)],
    ...priorFields(stage), ...reviewerFields(stage),
    ...optional("summary_confirmation", stage.summaryConfirmation === "none"
      ? undefined : stage.summaryConfirmation),
    ["inputs", stage.briefing.inputs], ["outputs", stage.briefing.outputs],
    ["rules_in_context", resolvedRules(request, node)],
    ["sensors_applicable", resolvedSensors(request, node)],
  ];
};

export const serializeCompiledMethod = (request: RenderingRequest): {
  readonly graph: string; readonly grid: string;
} => {
  const graph = request.method.graph.nodes.map((node) => Object.fromEntries(stageFields(request, node)));
  const scopes = request.method.scopes.toSorted((left, right) =>
    left.name < right.name ? -1 : Number(left.name > right.name));
  const grid = Object.fromEntries(scopes.map((scope) => {
    const column = new Set(scopeColumn({ method: request.method, scope: scope.name }).stages);
    return [scope.name, { stages: Object.fromEntries(request.method.graph.nodes.map((node) =>
      [node.stage, column.has(node.stage) ? "EXECUTE" : "SKIP"])) }];
  }));
  return { graph: `${JSON.stringify(graph, null, 2)}\n`, grid: `${JSON.stringify(grid, null, 2)}\n` };
};
