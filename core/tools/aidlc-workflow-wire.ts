// Explicit compatibility boundary for authored YAML and persisted stage graphs.
// Protocol spelling and field order are public data contracts, not compiler names.
// Graph/runtime callers keep GraphStage; the compiler uses WorkflowStage values.
import type { StageEntry } from "./aidlc-lib.ts";
import type { StageFrontmatter } from "./aidlc-stage-schema.ts";
import type { SensorManifest } from "./aidlc-sensor-schema.ts";
import type { RuleResolution, WorkflowStage, StageDefinition, SensorBinding, SensorSource } from "./aidlc-workflow-candidate.ts";

export type Consume = StageFrontmatter["consumes"][number];

export type { RuleResolution } from "./aidlc-workflow-candidate.ts";

// Per-sensor resolution row baked into each stage's sensors_applicable.
// Pull authoring: the stage's frontmatter `sensors: [<id>]` declares the
// import; the resolver looks the manifest up by id and copies its
// dispatch policy and capability metadata verbatim. matches is omitted when
// the manifest declares no path filter. Runtime dispatchers read this
// snapshotted binding off the graph node — never re-open the manifest.
export interface SensorResolution {
  id: string;
  path: string;
  fire_on: "write" | "gate";
  default_severity: "advisory" | "blocking";
  category?: string;
  matches?: string;
}

// Authoritative graph stage shape — fully-populated, no optionals
// except for genuinely-optional-per-spec fields (condition, for_each).
// StageEntry in lib.ts carries the same fields as optional so existing
// runtime callers stay source-compatible without caring about the
// extended shape.
export interface GraphStage extends StageEntry {
  plugin?: string;
  enabled?: false;
  condition?: string;
  produces: string[];
  // optional_produces - artifacts the stage MAY write per unit (marked
  // CONDITIONAL in the stage body). Genuinely optional per spec, like
  // for_each: only annotated stages carry it. Exempt from the per-unit
  // coverage check in aidlc-orchestrate.ts unitCovered, but still resolved
  // into the run-stage directive's produces paths and unioned into the
  // artifact registry / producersOf lookups.
  optional_produces?: string[];
  // produces_kinds - per-kind applicability map (artifact name to unit kinds).
  // Lives on stage YAML, round-trips through parse/emit, and compiles into
  // stage-graph.json. The engine's produces filter reads it to prune the
  // per-unit construction matrix; an unlisted artifact applies to all kinds.
  produces_kinds?: Record<string, string[]>;
  consumes: Consume[];
  requires_stage: string[];
  // sensors is the stage-side pull import — a list of sensor manifest
  // ids. Optional because most stages declare empty (initialization) or
  // some subset; the resolver treats absent and `[]` identically. Lives
  // on stage YAML and round-trips through parse/emit; sensors_applicable
  // is the resolved view.
  sensors?: string[];
  // scopes is the stage-side scope-membership list — the transpose of the
  // legacy scope-mapping.json EXECUTE/SKIP matrix onto stages. A scope name
  // present here marks this stage EXECUTE under that scope. Optional because
  // a fixture stage may declare none; resolver treats absent and `[]`
  // identically. Lives on stage YAML, round-trips through parse/emit, and is
  // transposed into the compiled grid (scope-grid.json) at compile time.
  scopes?: string[];
  inputs: string;
  outputs: string;
  for_each?: string;
  // rules_in_context is REQUIRED — never undefined. The resolver always
  // assigns an array (org+team+project minimum on populated workspaces;
  // [] only when .claude/rules/ is empty). Lives only on the in-memory
  // GraphStage and the compiled stage-graph.json — NOT on stage YAML.
  // (validateStageFrontmatter at aidlc-stage-schema.ts rejects unknown
  // stage YAML keys; introducing rules_in_context to stage frontmatter
  // would trip that guard.)
  rules_in_context: RuleResolution[];
  // sensors_applicable is REQUIRED — assigned [] when stage.sensors is
  // absent/empty. Same compile-baked discipline as rules_in_context.
  sensors_applicable: SensorResolution[];
  // reviewer — the agent to invoke as a quality gate after the stage body.
  // Absent when no review step is configured. Parsed from stage frontmatter
  // `reviewer:` field and carried through to the run-stage directive.
  reviewer?: string;
  // Required Markdown output that owns the appended reviewer section.
  review_artifact?: string;
  // reviewer_max_iterations — review cycle cap before escalating to human.
  // Defaults to 2 when reviewer is present.
  reviewer_max_iterations?: number;

  approval_mode?: "human" | "autonomous";
  // review_class — how the review runs: "adversarial" (refute + fix loop up
  // to the cap, §12a classic) or "advisory" (single pass, findings quoted at
  // the human gate, no fix loop). Defaults to "adversarial" when a reviewer
  // is present (the pre-class behavior). Absent when no reviewer. The
  // EFFECTIVE class at runtime may be lowered by the scope's review_cap or a
  // run override — resolveReviewClass in aidlc-lib.ts owns that resolution.
  review_class?: "adversarial" | "advisory";
  // Deterministic pre-generation consolidated-summary checkpoint policy.
  summary_confirmation?: "required" | "if-present";
}

export interface SensorFile {
  id: string;
  path: string;        // ".claude/sensors/aidlc-<id>.md"
  manifest: SensorManifest;
}

export const FIELD_ORDER = [
  "slug",
  "number",
  "name",
  "plugin",
  "enabled",
  "phase",
  "execution",
  "condition",
  "lead_agent",
  "support_agents",
  "mode",
  "for_each",
  "workspace_requires",
  "produces",
  "optional_produces",
  "produces_kinds",
  "consumes",
  "requires_stage",
  "sensors",
  "scopes",
  "reviewer",
  "review_artifact",
  "reviewer_max_iterations",
  "approval_mode",
  "review_class",
  "summary_confirmation",
  "inputs",
  "outputs",
  "rules_in_context",
  "sensors_applicable",
] as const;

/** Canonical JSON emitter. The ONLY place that writes stage-graph.json
 *  bytes. Pinning the emitter in one function makes `compile --check`
 *  byte-compare robust — formatter drift is impossible when there's
 *  exactly one writer. */
export function canonicalStageGraphJson(stages: GraphStage[]): string {
  // Build each object with pinned key order so JSON.stringify emits
  // keys in the canonical order regardless of construction order.
  const ordered = stages.map((stage) => Object.fromEntries(
    FIELD_ORDER.filter((key) => stage[key] !== undefined).map((key) => [key, stage[key]]),
  ));
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

export function stageDefinitionFromFrontmatter(parsed: StageFrontmatter): StageDefinition {
  return {
    slug: parsed.slug, number: parsed.number, name: parsed.name,
    plugin: parsed.plugin, phase: parsed.phase, execution: parsed.execution,
    condition: parsed.condition, leadAgent: parsed.lead_agent,
    supportAgents: parsed.support_agents ?? [], mode: parsed.mode,
    produces: parsed.produces ?? [], optionalProduces: parsed.optional_produces,
    producesKinds: parsed.produces_kinds,
    consumes: (parsed.consumes ?? []).map((consume) => ({
      artifact: consume.artifact, requirement: consume.required ? "required" : "optional", conditionalOn: consume.conditional_on,
    })),
    requiresStage: parsed.requires_stage ?? [], sensors: parsed.sensors, scopes: parsed.scopes,
    inputs: parsed.inputs ?? "", outputs: parsed.outputs ?? "",
    forEach: parsed.for_each, workspaceRequirement: parsed.workspace_requires === undefined ? undefined :
      parsed.workspace_requires ? "required" : "not-required",
    reviewer: parsed.reviewer, reviewArtifact: parsed.review_artifact,
    reviewerMaxIterations: parsed.reviewer_max_iterations, reviewClass: parsed.review_class,
    approvalMode: parsed.approval_mode, summaryConfirmation: parsed.summary_confirmation,
  };
}

/** Capture only metadata consumed by compilation, not the mutable manifest. */
export function sensorSourceFromFile(sensor: SensorFile): SensorSource {
  return {
    id: sensor.id, path: sensor.path,
    fireOn: sensor.manifest.fire_on, defaultSeverity: sensor.manifest.default_severity,
    category: sensor.manifest.category, matches: sensor.manifest.matches,
  };
}

export function sensorBindingToWire(sensor: SensorBinding): SensorResolution {
  const resolved: SensorResolution = {
    id: sensor.id, path: sensor.path, fire_on: sensor.fireOn, default_severity: sensor.defaultSeverity,
  };
  if (sensor.category !== undefined) resolved.category = sensor.category;
  if (sensor.matches !== undefined) resolved.matches = sensor.matches;
  return resolved;
}

function consumeToWire(consume: WorkflowStage["consumes"][number]): Consume {
  const resolved: Consume = { artifact: consume.artifact, required: consume.requirement === "required" };
  if (consume.conditionalOn !== undefined) resolved.conditional_on = consume.conditionalOn;
  return resolved;
}

/** Preserve both protocol names and absence of unauthored optional properties. */
export function workflowStageToGraph(stage: WorkflowStage): GraphStage {
  const graph: GraphStage = {
    slug: stage.slug, number: stage.number, name: stage.name, phase: stage.phase,
    execution: stage.execution, lead_agent: stage.leadAgent, support_agents: stage.supportAgents,
    mode: stage.mode, produces: stage.produces, consumes: stage.consumes.map(consumeToWire),
    requires_stage: stage.requiresStage, inputs: stage.inputs, outputs: stage.outputs,
    rules_in_context: stage.rulesInContext, sensors_applicable: stage.sensorsApplicable.map(sensorBindingToWire),
  };
  if (stage.plugin !== undefined) graph.plugin = stage.plugin;
  if (stage.condition !== undefined) graph.condition = stage.condition;
  if (stage.forEach !== undefined) graph.for_each = stage.forEach;
  if (stage.workspaceRequirement !== undefined) graph.workspace_requires = stage.workspaceRequirement === "required";
  if (stage.optionalProduces !== undefined) graph.optional_produces = stage.optionalProduces;
  if (stage.producesKinds !== undefined) graph.produces_kinds = stage.producesKinds;
  if (stage.sensors !== undefined) graph.sensors = stage.sensors;
  if (stage.scopes !== undefined) graph.scopes = stage.scopes;
  if (stage.reviewer !== undefined) {
    graph.reviewer = stage.reviewer;
    graph.review_artifact = stage.reviewArtifact;
    graph.reviewer_max_iterations = stage.reviewerMaxIterations;
    graph.review_class = stage.reviewClass;
  }
  if (stage.summaryConfirmation !== undefined) graph.summary_confirmation = stage.summaryConfirmation;
  if (stage.approvalMode !== undefined) graph.approval_mode = stage.approvalMode;
  if (stage.enabled !== undefined) graph.enabled = stage.enabled;
  return graph;
}

export function workflowGraphJson(stages: readonly WorkflowStage[]): string {
  return canonicalStageGraphJson(stages.map(workflowStageToGraph));
}
