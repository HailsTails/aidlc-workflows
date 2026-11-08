import { z } from "zod";
import type { HostIdentity } from "../../kernel/host.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import { graphEntries, type GraphEntry, type Method } from "../../workflow-definition/domain/method.ts";
import { scopeColumn } from "../../workflow-definition/domain/scope-grid.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import type { StageNode } from "../../workflow-definition/domain/stage-graph.ts";
import { COLLABORATION_MODES, PHASES, PROJECT_TYPES, UNIT_KINDS }
  from "../../workflow-definition/domain/vocabulary.ts";

export type CompiledMethodFiles = { readonly graph: string; readonly grid: string };

type RenderingRequest = { readonly method: Method; readonly host: HostIdentity;
  readonly memoryRoot: ProjectPath };

const resolvedRuleSchema = z.strictObject({
  path: z.string(), scope: z.enum(["org", "team", "project", "phase"]),
});
const resolvedSensorSchema = z.strictObject({
  id: z.string(), path: z.string(), ["fire_on"]: z.enum(["write", "gate"]),
  ["default_severity"]: z.enum(["advisory", "blocking"]),
  category: z.string().optional(), matches: z.string().optional(),
});
const compiledStageSchema = z.strictObject({
  slug: z.string(), number: z.string(), name: z.string(),
  plugin: z.string().optional(), enabled: z.literal(false).optional(),
  phase: z.enum(PHASES), execution: z.enum(["ALWAYS", "CONDITIONAL"]), condition: z.string(),
  ["lead_agent"]: z.string(), ["support_agents"]: z.array(z.string()),
  mode: z.enum(COLLABORATION_MODES), ["for_each"]: z.literal("unit-of-work").optional(),
  ["workspace_requires"]: z.literal(true).optional(),
  produces: z.array(z.string()), ["optional_produces"]: z.array(z.string()).optional(),
  ["produces_kinds"]: z.record(z.string(), z.array(z.enum(UNIT_KINDS))).optional(),
  consumes: z.array(z.strictObject({ artifact: z.string(), required: z.boolean(),
    ["conditional_on"]: z.enum(PROJECT_TYPES).optional() })),
  cites: z.array(z.string()).optional(),
  ["requires_stage"]: z.array(z.string()), sensors: z.array(z.string()), scopes: z.array(z.string()),
  ars: z.strictObject({
    targets: z.array(z.enum(["iae", "csu", "ve", "r", "ua"])),
    cost: z.number().int().min(1).max(5).nullable(),
    role: z.enum(["initialization", "core", "phase-gate", "structural"]).optional(),
    ["project_types"]: z.array(z.enum(PROJECT_TYPES)).optional(),
  }).optional(),
  reviewer: z.string().optional(), ["review_artifact"]: z.string().optional(),
  ["reviewer_max_iterations"]: z.number().int().positive().optional(),
  ["review_class"]: z.enum(["adversarial", "advisory"]).optional(),
  ["summary_confirmation"]: z.enum(["required", "if-present"]).optional(),
  inputs: z.string(), outputs: z.string(),
  ["rules_in_context"]: z.array(resolvedRuleSchema),
  ["sensors_applicable"]: z.array(resolvedSensorSchema),
});
export const CompiledGraphFileSchema = z.array(compiledStageSchema);
export const CompiledScopeGridFileSchema = z.record(z.string(), z.strictObject({
  stages: z.record(z.string(), z.enum(["EXECUTE", "SKIP"])),
}));
type CompiledStageFile = z.infer<typeof compiledStageSchema>;
type CompiledScopeGridFile = z.infer<typeof CompiledScopeGridFileSchema>;

const productionFields = (stage: Stage): Pick<CompiledStageFile,
  "produces" | "optional_produces" | "produces_kinds"> => {
  const additional = stage.produces.filter((production) => production.obligation === "optional")
    .map((production) => production.artifact);
  const kinds = stage.produces.flatMap<readonly [string,
    NonNullable<CompiledStageFile["produces_kinds"]>[string]]>((production) => production.unitKinds === "all"
    ? [] : [[production.artifact, [...production.unitKinds]]]);
  return {
    produces: stage.produces.filter((production) => production.obligation === "required")
      .map((production) => production.artifact),
    ["optional_produces"]: additional.length > 0 ? additional : undefined,
    ["produces_kinds"]: kinds.length > 0 ? Object.fromEntries(kinds) : undefined,
  };
};

const consumptionFields = (stage: Stage): Pick<CompiledStageFile, "consumes" | "cites"> => {
  const citations = stage.consumes.filter((consumption) => consumption.citation === "cited")
    .map((consumption) => consumption.artifact);
  return {
    consumes: stage.consumes.map((consumption) => ({ artifact: consumption.artifact,
      required: consumption.obligation === "required",
      ["conditional_on"]: consumption.when === "always" ? undefined : consumption.when,
    })),
    cites: citations.length > 0 ? citations : undefined,
  };
};

const reviewerFields = (stage: Stage): Pick<CompiledStageFile,
  "reviewer" | "review_artifact" | "reviewer_max_iterations" | "review_class"> => stage.review ? {
  reviewer: stage.review.reviewer, ["review_artifact"]: stage.review.artifact,
  ["reviewer_max_iterations"]: stage.review.maxIterations, ["review_class"]: stage.review.reviewClass,
} : {};

const priorFields = (stage: Stage): Pick<CompiledStageFile, "ars"> => {
  const prior = stage.composerPrior;
  return prior ? { ars: { targets: [...prior.targets], cost: prior.cost,
    role: prior.role ?? undefined,
    ["project_types"]: prior.projectTypes.length > 0 ? [...prior.projectTypes] : undefined,
  } } : {};
};

const resolvedRules = (request: RenderingRequest, node: StageNode):
  CompiledStageFile["rules_in_context"] => node.rulesInContext.flatMap((identity) => {
    const rule = request.method.rules.find((candidate) => candidate.id === identity);
    return rule ? [{ path: `${request.memoryRoot}/${identity}.md`, scope: rule.layer.kind }] : [];
  });

const resolvedSensors = (request: RenderingRequest, node: StageNode):
  CompiledStageFile["sensors_applicable"] => node.activeSensors.flatMap((identity) => {
    const sensor = request.method.sensors.find((candidate) => candidate.id === identity);
    return sensor ? [{ id: sensor.id, path: `${request.host.directory}/${sensor.source}`,
      ["fire_on"]: sensor.firesOn, ["default_severity"]: sensor.severity,
      category: sensor.category ?? undefined, matches: sensor.matches ?? undefined,
    }] : [];
  });

const stageFile = (request: RenderingRequest, entry: GraphEntry): CompiledStageFile => {
  const { stage, node } = entry;
  return {
    slug: stage.slug, number: node.number, name: stage.displayName,
    plugin: stage.owner.kind === "plugin" ? stage.owner.plugin : undefined,
    enabled: node.availability === "disabled" ? false : undefined,
    phase: stage.phase, execution: stage.execution.trigger === "always" ? "ALWAYS" : "CONDITIONAL",
    condition: stage.execution.condition,
    ["lead_agent"]: stage.participation.lead.kind === "conductor"
      ? "orchestrator" : stage.participation.lead.agent,
    ["support_agents"]: [...stage.participation.supports], mode: stage.participation.mode,
    ["for_each"]: stage.cardinality.kind === "per-unit" ? "unit-of-work" : undefined,
    ["workspace_requires"]: stage.workspace === "writes" ? true : undefined,
    ...productionFields(stage), ...consumptionFields(stage),
    ["requires_stage"]: [...new Set(stage.requires)], sensors: [...stage.sensors],
    scopes: request.method.memberships.filter((membership) => membership.stage === stage.slug)
      .map((membership) => membership.scope),
    ...priorFields(stage), ...reviewerFields(stage),
    ["summary_confirmation"]: stage.summaryConfirmation === "none"
      ? undefined : stage.summaryConfirmation,
    inputs: stage.briefing.inputs, outputs: stage.briefing.outputs,
    ["rules_in_context"]: resolvedRules(request, node),
    ["sensors_applicable"]: resolvedSensors(request, node),
  };
};

export const serializeCompiledMethod = (request: RenderingRequest): CompiledMethodFiles => {
  const graph: z.infer<typeof CompiledGraphFileSchema> = graphEntries(request.method)
    .map((entry) => stageFile(request, entry));
  const scopes = request.method.scopes.toSorted((left, right) =>
    left.name < right.name ? -1 : Number(left.name > right.name));
  const columns = scopes.map<readonly [string, CompiledScopeGridFile[string]]>((scope) => {
    const column = new Set(scopeColumn({ method: request.method, scope: scope.name }).stages);
    return [scope.name, { stages: Object.fromEntries(request.method.graph.nodes
      .map<readonly [string, CompiledScopeGridFile[string]["stages"][string]]>((node) =>
        [node.stage, column.has(node.stage) ? "EXECUTE" : "SKIP"])) }];
  });
  const grid: CompiledScopeGridFile = Object.fromEntries(columns);
  return { graph: `${JSON.stringify(graph, null, 2)}\n`, grid: `${JSON.stringify(grid, null, 2)}\n` };
};
