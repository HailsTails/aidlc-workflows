// Workflow definition compilation. Value inputs only: no project writes, runtime
// selection, process environment, caches, console output, or approval decisions.
import { errorMessage, isScopeName, parseStageFrontmatter, stageEnabledForPlugins, PHASES, type StageEntry } from "./aidlc-lib.ts";
import { validateStageFrontmatter } from "./aidlc-stage-schema.ts";
import { stageDefinitionFromFrontmatter, workflowGraphJson } from "./aidlc-workflow-wire.ts";

export interface Consume {
  artifact: string;
  requirement: "required" | "optional";
  conditionalOn?: "brownfield" | "greenfield";
}

export interface RuleResolution {
  path: string;
  scope: "org" | "team" | "project" | "phase";
}

export interface SensorBinding {
  id: string;
  path: string;
  fireOn: "write" | "gate";
  defaultSeverity: "advisory" | "blocking";
  category?: string;
  matches?: string;
}

export type SensorSource = SensorBinding;

/** Validated authoring values admitted at the YAML boundary. Number and name
 * remain author overrides until graph construction resolves missing values. */
export interface StageDefinition {
  slug: string;
  number?: string;
  name?: string;
  plugin?: string;
  phase: string;
  execution: "ALWAYS" | "CONDITIONAL";
  condition?: string;
  leadAgent: string;
  supportAgents: string[];
  mode: string;
  forEach?: string;
  workspaceRequirement?: "required" | "not-required";
  produces: string[];
  optionalProduces?: string[];
  producesKinds?: Record<string, string[]>;
  consumes: Consume[];
  requiresStage: string[];
  sensors?: string[];
  scopes?: string[];
  inputs: string;
  outputs: string;
  reviewer?: string;
  reviewArtifact?: string;
  reviewerMaxIterations?: number;
  reviewClass?: "adversarial" | "advisory";
  approvalMode?: "human" | "autonomous";
  summaryConfirmation?: "required" | "if-present";
}

/** Compiler-owned graph values. Only the wire adapter owns protocol spelling. */
export interface WorkflowStage extends StageDefinition {
  number: string;
  name: string;
  enabled?: false;
  rulesInContext: RuleResolution[];
  sensorsApplicable: SensorBinding[];
}

export interface ComposedScopeRecord {
  /** The scope name from frontmatter (the grid key and `--scope` argument). */
  name: string;
  /** The harness-tree projection: everything above the generated grid region. */
  identity: string;
  /** The EXECUTE/SKIP grid this scope resolves to. */
  stages: Record<string, "EXECUTE" | "SKIP">;
}

// Filename anchor — sensor manifests live at `.claude/sensors/aidlc-<id>.md`.
// Anything not matching the prefix is silently ignored (mirrors loadRules).
export interface RuleBindingSource {
  readonly path: string;
  readonly scope: RuleResolution["scope"];
  readonly phase?: string;
}

/** A captured candidate, not a handle into an installed runtime. The filesystem
 * adapter validates scope/agent/rule/sensor authoring and freezes these plain
 * values. Compilation parses and validates stage sources, then owns the graph
 * decisions. Neither phase changes the other input or a live workflow. */
export interface WorkflowCompilationRequest {
  readonly stageSources: readonly { readonly path: string; readonly phase: string; readonly text: string }[];
  readonly existingStages: readonly Pick<StageEntry, "slug" | "number" | "name">[];
  readonly knownAgents: readonly string[];
  readonly rules: readonly RuleBindingSource[];
  readonly sensors: readonly SensorSource[];
  readonly selectedPlugins: readonly string[] | null;
  readonly selectedScopeNames: readonly string[] | null;
  readonly installedScopeNames: readonly string[];
  readonly composedRecords: Record<string, ComposedScopeRecord>;
  readonly priorGridJson: string | null;
}

export interface WorkflowCandidate {
  readonly json: string;
  readonly gridJson: string;
  readonly grid: PreservedScopeGrid;
  readonly stages: readonly WorkflowStage[];
  readonly advisories: readonly string[];
  readonly composedScopes: {
    readonly names: readonly string[];
    readonly recordNames: readonly string[];
    readonly gridOnlyNames: readonly string[];
  };
}

/** Captures/results contain plain values only. Freeze every nested value so a
 * caller cannot accidentally change a candidate after validation. */
export function freezeWorkflowValue<T>(workflowValue: T): T {
  if (workflowValue !== null && typeof workflowValue === "object") {
    Object.values(workflowValue).forEach(freezeWorkflowValue);
    Object.freeze(workflowValue);
  }
  return workflowValue;
}

interface StageDeclaration {
  readonly sourcePath: string;
  readonly phase: string;
  readonly frontmatter: StageDefinition;
}

interface NewStageSeed {
  readonly declaration: StageDeclaration;
  readonly name: string;
}

/** Source identity is lexical, not the host OS's idea of a path. Captures and
 * detached requests may use either separator on any platform. */
export function workflowSourceStem(sourcePath: string): string {
  return (sourcePath.split(/[\\/]/).at(-1) ?? "").replace(/\.md$/, "");
}

function parseStageDeclaration(
  source: WorkflowCompilationRequest["stageSources"][number],
  knownAgents: readonly string[],
): StageDeclaration {
  const filePath = source.path;
  // Wrap parse in filename context — parseStageFrontmatter's default
  // error messages don't include the file path, which makes debugging
  // a bad YAML edit across 31 stage files painful.
  let parsed: Record<string, unknown>;
  try {
    parsed = parseStageFrontmatter(source.text);
  } catch (err) {
    throw new Error(`${filePath}: ${errorMessage(err)}`);
  }

  // Validate frontmatter against stage-schema.ts before extracting fields
  // — the validator returns a typed StageFrontmatter, so subsequent reads
  // (slug, phase, etc.) need no casts. Catches missing required fields
  // (e.g., execution: undefined would silently drop from the emitted JSON
  // via canonicalStageGraphJson's undefined skip). Passing knownAgents
  // activates the agent-registration cross-check (Rule 9): an unknown
  // lead_agent / support_agent fails here, not at runtime.
  const validation = validateStageFrontmatter(parsed, { agents: [...knownAgents] });
  if (!validation.valid) {
    throw new Error(
      `${filePath}: schema validation failed: ${validation.errors.join("; ")}`
    );
  }
  const slug = validation.data.slug;
  const plugin = validation.data.plugin;
  if (plugin !== undefined) {
    if (plugin === "aidlc") {
      throw new Error(
        `${filePath}: stage "${slug}" declares plugin "aidlc"; omit plugin for core stages.`
      );
    }
    // `aidlc-` is core's namespace: runner dirs are `aidlc-<slug>` for core
    // but the bare slug for plugin stages, so a plugin named `aidlc-<x>`
    // generates runner paths identical to core's and silently clobbers them
    // (/aidlc-<x>-... routes to the wrong stage).
    if (plugin.startsWith("aidlc-")) {
      throw new Error(
        `${filePath}: stage "${slug}" declares plugin "${plugin}"; the "aidlc-" prefix is reserved for core (a plugin named aidlc-<x> collides with core runner paths). Rename the plugin.`
      );
    }
    if (!slug.startsWith(`${plugin}-`)) {
      throw new Error(
        `${filePath}: stage "${slug}" declares plugin "${plugin}", but plugin-owned stage slugs must start with "${plugin}-". Rename the slug or fix the plugin field.`
      );
    }
  }

  const filenameStem = workflowSourceStem(filePath);
  if (filenameStem !== slug) {
    throw new Error(
      `${filePath}: stage filename stem "${filenameStem}" does not match frontmatter slug "${slug}". Rename the file or fix the slug.`
    );
  }


  return { sourcePath: filePath, phase: source.phase, frontmatter: stageDefinitionFromFrontmatter(validation.data) };
}

function maximumPinnedIndices(stages: WorkflowCompilationRequest["existingStages"]): ReadonlyMap<number, number> {
  return stages.reduce((maximums, stage) => {
    const [prefix, index] = stage.number.split(".").map((segment) => parseInt(segment, 10));
    if (!Number.isFinite(prefix) || !Number.isFinite(index)) return maximums;
    return new Map(maximums).set(prefix, Math.max(maximums.get(prefix) ?? 0, index));
  }, new Map<number, number>());
}

function indexDeclarations(
  declarations: readonly StageDeclaration[],
  artifactsFor: (declaration: StageDeclaration) => readonly string[],
): ReadonlyMap<string, readonly StageDeclaration[]> {
  return declarations.flatMap((declaration) =>
    [...new Set(artifactsFor(declaration))].map((artifact) => ({ artifact, declaration })),
  ).reduce((index, binding) =>
    new Map(index).set(binding.artifact, [...(index.get(binding.artifact) ?? []), binding.declaration]),
    new Map<string, readonly StageDeclaration[]>(),
  );
}

function validateArtifactProducers(declarations: readonly StageDeclaration[]): void {
  const producersByArtifact = indexDeclarations(declarations, ({ frontmatter }) => [
    ...(frontmatter.produces ?? []), ...(frontmatter.optionalProduces ?? []),
  ]);
  const consumersByArtifact = indexDeclarations(declarations, ({ frontmatter }) =>
    (frontmatter.consumes ?? []).map((consume) => consume.artifact),
  );
  const duplicate = [...producersByArtifact].find(([artifact, producers]) =>
    producers.length > 1 && consumersByArtifact.has(artifact),
  );
  if (duplicate === undefined) return;
  const [artifact, producers] = duplicate;
  const consumer = consumersByArtifact.get(artifact)![0];
  const producerList = producers.map(({ sourcePath, frontmatter }) =>
    `${sourcePath} (stage "${frontmatter.slug}")`,
  ).join(", ");
  throw new Error(
    `Duplicate producers for consumed artifact "${artifact}" in ${producerList} — ` +
      `consumed by stage "${consumer.frontmatter.slug}" in ${consumer.sourcePath}. ` +
      `Rename one produced artifact or update the consumer.`,
  );
}

function authoredStageIndex(seed: NewStageSeed): number {
  const authored = seed.declaration.frontmatter.number;
  if (!authored) return Number.POSITIVE_INFINITY;
  const index = parseInt(authored.split(".")[1], 10);
  return Number.isFinite(index) ? index : Number.POSITIVE_INFINITY;
}

function compareStageSeeds(left: NewStageSeed, right: NewStageSeed): number {
  return authoredStageIndex(left) - authoredStageIndex(right) ||
    left.declaration.frontmatter.slug.localeCompare(right.declaration.frontmatter.slug);
}

/** Each reduction emits at most one ready stage. Dependencies outside this
 * batch are checked later against the final numeric graph. Repeated edges are
 * set-valued, and a stuck suffix preserves source order in the diagnostic. */
function orderNewStages(batch: readonly NewStageSeed[]): readonly NewStageSeed[] {
  const batchSlugs = new Set(batch.map(({ declaration }) => declaration.frontmatter.slug));
  const ordered = batch.reduce<readonly NewStageSeed[]>((emitted) => {
    const emittedSlugs = new Set(emitted.map(({ declaration }) => declaration.frontmatter.slug));
    const ready = batch.filter(({ declaration }) =>
      !emittedSlugs.has(declaration.frontmatter.slug) &&
      (declaration.frontmatter.requiresStage ?? []).every((dependency) =>
        !batchSlugs.has(dependency) || emittedSlugs.has(dependency),
      ),
    ).sort(compareStageSeeds);
    return ready.length === 0 ? emitted : [...emitted, ready[0]];
  }, []);
  if (ordered.length === batch.length) return ordered;
  const stuck = batch.filter((seed) => !ordered.includes(seed)).map(({ declaration }) => declaration.frontmatter.slug);
  throw new Error(
    `Cannot seed stage numbers for phase "${batch[0].declaration.phase}": ` +
      `requires_stage cycle among new stages (stuck: ${stuck.join(", ")}). Break the cycle.`,
  );
}

function validateNumberedEdges(stages: readonly WorkflowStage[], sourcePaths: ReadonlyMap<string, string>): void {
  const numbersBySlug = new Map(stages.map((stage) => [stage.slug, stage.number]));
  const invalidEdge = stages.flatMap((stage) => stage.requiresStage.map((dependency) => ({ stage, dependency })))
    .find(({ stage, dependency }) => {
      const dependencyNumber = numbersBySlug.get(dependency);
      return !dependencyNumber || numericStageOrder(dependencyNumber, stage.number) >= 0;
    });
  if (invalidEdge === undefined) return;
  const { stage, dependency } = invalidEdge;
  const dependencyNumber = numbersBySlug.get(dependency);
  if (!dependencyNumber) {
    throw new Error(
      `${sourcePaths.get(stage.slug)}: Unknown requires_stage: "${dependency}" on stage "${stage.slug}". ` +
        `Every requires_stage entry must reference a known stage slug.`,
    );
  }
  throw new Error(
    `${sourcePaths.get(stage.slug)}: Compile invariant violated: stage "${stage.slug}" (${stage.number}) ` +
      `requires "${dependency}" (${dependencyNumber}) — dependency must be lower-numbered. ` +
      `Fix: either renumber in stage-graph.json to match the dependency ` +
      `direction, or remove the offending requires_stage edge.`,
  );
}

interface IndexedStageSeed extends NewStageSeed {
  readonly prefix: number;
  readonly number: string | undefined;
}

function indexStageSources(request: WorkflowCompilationRequest) {
  const pinnedNumbers = new Map(request.existingStages.map((stage) => [stage.slug, stage.number]));
  const pinnedNames = new Map(request.existingStages.map((stage) => [stage.slug, stage.name]));
  const sourcePaths = new Map<string, string>();
  const declarations = request.stageSources.map((source) => {
    const declaration = parseStageDeclaration(source, request.knownAgents);
    const slug = declaration.frontmatter.slug;
    const previousFile = sourcePaths.get(slug);
    if (previousFile) {
      throw new Error(
        `Duplicate stage slug "${slug}" in ${source.path} — already declared ` +
          `in ${previousFile}. Rename one of them.`,
      );
    }
    sourcePaths.set(slug, source.path);
    const prefix = PHASES.findIndex((phaseName) => phaseName === declaration.phase);
    if (prefix < 0) {
      throw new Error(
        `Stage "${slug}" (${source.path}) is in an unknown phase directory ` +
          `"${declaration.phase}". Stage phase directories must be one of: ${PHASES.join(", ")}.`,
      );
    }
    return { declaration, prefix,
      number: declaration.frontmatter.number ?? pinnedNumbers.get(slug),
      name: declaration.frontmatter.name ?? pinnedNames.get(slug) ?? titleCaseSlug(slug),
    };
  });
  return { declarations, sourcePaths };
}

function numberDeclaredStages(declarations: readonly IndexedStageSeed[], existingStages: WorkflowCompilationRequest["existingStages"]) {
  // Authored numbers remain absolute overrides. Otherwise preserve the last
  // pinned row, and seed unnumbered rows beyond every existing phase index.
  // Numbered rows precede seeded rows before the stable numeric sort.
  const maximumIndices = maximumPinnedIndices(existingStages);
  const numbered = declarations.flatMap(({ declaration, number, name }) =>
    number ? [buildWorkflowStage({ definition: declaration.frontmatter, phase: declaration.phase, number, name })] : [],
  );
  const newPrefixes = [...new Set(declarations.filter(({ number }) => !number).map(({ prefix }) => prefix))]
    .sort((left, right) => left - right);
  const seeded = newPrefixes.flatMap((prefix) =>
    orderNewStages(declarations.filter((declaration) => !declaration.number && declaration.prefix === prefix))
      .map(({ declaration, name }, index) => buildWorkflowStage({
        definition: declaration.frontmatter, phase: declaration.phase, number: `${prefix}.${(maximumIndices.get(prefix) ?? 0) + index + 1}`, name,
      })),
  );
  return [...numbered, ...seeded].sort((left, right) => numericStageOrder(left.number, right.number));
}

interface StageBindingContext {
  readonly sensors: WorkflowCompilationRequest["sensors"];
  readonly rules: WorkflowCompilationRequest["rules"];
  readonly selectedPlugins: WorkflowCompilationRequest["selectedPlugins"];
  readonly sourcePaths: ReadonlyMap<string, string>;
}

function bindStageContext(stages: readonly WorkflowStage[], context: StageBindingContext): WorkflowStage[] {
  const sensorsById = new Map(context.sensors.map((sensor) => [sensor.id, sensor]));
  const selectedPlugins = context.selectedPlugins === null ? null : new Set(context.selectedPlugins);
  return stages
    .map((stage) => {
      let sensors: SensorBinding[];
      try {
        sensors = resolveSensorsForStage(stage, sensorsById);
      } catch (error) {
        throw new Error(`${context.sourcePaths.get(stage.slug)}: ${errorMessage(error)}`);
      }
      return { ...stage, rulesInContext: resolveRulesForStage(stage, context.rules), sensorsApplicable: sensors,
        ...(!stageEnabledForPlugins(stage, selectedPlugins) ? { enabled: false as const } : {}),
      };
    });
}

function workflowAdvisories(stages: readonly WorkflowStage[]): string[] {
  return stages.filter((stage) =>
    stage.phase === "construction" && stage.forEach === "unit-of-work" &&
    stage.workspaceRequirement === "required" && stage.mode !== "subagent",
  ).map((stage) =>
    `[advisory] stage "${stage.slug}" is the per-unit build stage ` +
      `(for_each: unit-of-work + workspace_requires) but mode is ` +
      `"${stage.mode}", not "subagent" — the autonomous Construction ` +
      `swarm will NOT fire for it; units build serially.`,
  );
}

function compileScopeGrid(stages: readonly WorkflowStage[], request: WorkflowCompilationRequest) {
  const selectedScopes = request.selectedScopeNames === null ? null : new Set(request.selectedScopeNames);
  const foldBack = composedFoldBack({
    records: request.composedRecords, onDiskJson: request.priorGridJson,
    stockScopeNames: stageDeclaredScopeNames(stages), installedScopeNames: new Set(request.installedScopeNames),
  });
  const seededScopes = selectedScopes === null ? undefined : new Set(
    [...selectedScopes].filter((name) => !foldBack.names.has(name)),
  );
  const grid = filterScopeGrid({ grid: mergeComposedScopes({
    fresh: transposeScopeGrid(stages.filter((stage) => stage.enabled !== false), seededScopes),
    onDiskJson: foldBack.json, preserveNames: foldBack.names,
  }), allowedScopes: selectedScopes, exemptScopes: foldBack.names });
  return { grid, composedScopes: {
    names: [...foldBack.names], recordNames: [...foldBack.recordNames], gridOnlyNames: [...foldBack.gridOnlyNames],
  } };
}

export function compileWorkflowCandidate(request: WorkflowCompilationRequest): WorkflowCandidate {
  const { declarations, sourcePaths } = indexStageSources(request);
  validateArtifactProducers(declarations.map(({ declaration }) => declaration));
  const stages = bindStageContext(numberDeclaredStages(declarations, request.existingStages), {
    rules: request.rules, sensors: request.sensors, selectedPlugins: request.selectedPlugins, sourcePaths,
  });
  validateSelectionClosure(stages, sourcePaths);
  validateNumberedEdges(stages, sourcePaths);
  const { grid, composedScopes } = compileScopeGrid(stages, request);
  return freezeWorkflowValue(structuredClone({
    json: workflowGraphJson(stages), grid, gridJson: canonicalScopeGridJson(grid), stages,
    advisories: workflowAdvisories(stages), composedScopes,
  }));
}

interface NumberedStageSeed {
  readonly definition: StageDefinition;
  readonly phase: string;
  readonly number: string;
  readonly name: string;
}

type ReviewPolicy = Pick<StageDefinition, "reviewer" | "reviewArtifact" | "reviewerMaxIterations" | "reviewClass">;

function reviewerPolicy(definition: StageDefinition): ReviewPolicy {
  if (definition.reviewer === undefined) return {};
  const cap = Number(definition.reviewerMaxIterations);
  return {
    reviewer: definition.reviewer, reviewArtifact: definition.reviewArtifact,
    reviewerMaxIterations: definition.reviewerMaxIterations !== undefined && Number.isInteger(cap) && cap >= 1 ? cap : 2,
    reviewClass: definition.reviewClass === "advisory" ? "advisory" : "adversarial",
  };
}

function buildWorkflowStage(seed: NumberedStageSeed): WorkflowStage {
  const definition = seed.definition;
  return {
    ...definition, number: seed.number, name: seed.name, phase: definition.phase ?? seed.phase,
    // Repeated dependencies are one edge for both numbering and runtime.
    requiresStage: [...new Set(definition.requiresStage)],
    rulesInContext: [], sensorsApplicable: [], ...reviewerPolicy(definition),
  };
}

/** Build the strict-additive per-stage chain. Every applicable rule is
 *  included; nothing drops. Length 3 (org+team+project) when no phase
 *  rule applies, 4 (org+team+project+phase) when the stage's
 *  `phase: <name>` matches a phase-rule filename. Length 0 only when
 *  the rules directory is empty.
 *
 *  Pull authoring: org/team/project attach by filename to every stage
 *  (universal-default tier); the matching phase rule attaches because
 *  the stage already declared `phase: <name>` in its frontmatter — that
 *  declaration is the pull import. No glob filter on the rule side. */
export function resolveRulesForStage(
  stage: Pick<WorkflowStage, "phase">,
  rules: readonly RuleBindingSource[],
): RuleResolution[] {
  return rules.filter((rule) => rule.scope === "org" || rule.scope === "team" || rule.scope === "project" ||
    (rule.scope === "phase" && rule.phase === stage.phase))
    .map((rule) => ({ path: rule.path, scope: rule.scope }));
}

/** Resolve a stage's `sensors:` imports against the manifest registry.
 *  Throws when an imported id has no matching manifest — authoring
 *  errors fail loud at compile, not silently at fire time. Preserves
 *  declared import order (deterministic emission for the JSON pin). */
export function resolveSensorsForStage(
  stage: Pick<WorkflowStage, "slug" | "sensors">,
  sensorsById: ReadonlyMap<string, SensorSource>,
): SensorBinding[] {
  return (stage.sensors ?? []).map((id) => {
    const sensor = sensorsById.get(id);
    if (!sensor) {
      const known = [...sensorsById.keys()].sort().join(", ") || "(none)";
      throw new Error(
        `Stage "${stage.slug}" imports unknown sensor id "${id}". ` +
          `Known ids: ${known}`,
      );
    }
    const entry: SensorBinding = {
      id: sensor.id,
      path: sensor.path,
      fireOn: sensor.fireOn,
      defaultSeverity: sensor.defaultSeverity,
    };
    if (sensor.category !== undefined) {
      entry.category = sensor.category;
    }
    if (sensor.matches !== undefined) {
      entry.matches = sensor.matches;
    }
    return entry;
  });
}

// --- Scope grid (the transpose) ---
//
// The compiled scope-grid.json is the EXECUTE/SKIP matrix, derived by
// transposing each stage's `scopes:` membership list. It is a PURE
// transpose — no graph-closure, no predicate. Shape is
// `{ <scope>: { stages: { <slug>: "EXECUTE" | "SKIP" } } }`, exactly the
// `.stages` half of the legacy scope-mapping.json so the runtime
// consumers that read `mapping[scope].stages` stay byte-for-byte
// unchanged. The scope-prose metadata (depth/keywords/description) lives
// in `.claude/scopes/aidlc-<name>.md`, not here.

export interface ScopeGrid {
  [scope: string]: { stages: Record<string, "EXECUTE" | "SKIP"> };
}

/** Compatibility projection, not a claim that migration data is a valid plan.
 * Older installs retain any object-valued stages member, including null and
 * arrays, and extra entry fields. Consumers must inspect cells before use. */
export interface PreservedScopeGrid {
  [scope: string]: { stages: object | null };
}

function isLegacyGridRoot(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
}

function isLegacyScopeEntry(candidate: unknown): candidate is PreservedScopeGrid[string] {
  return isLegacyGridRoot(candidate) && typeof candidate.stages === "object";
}

/** A single admission owner for both metadata discovery and entry fold-back.
 * Keep names even when their entry cannot contribute a grid column. That is
 * the existing grid-only migration contract, not validation of a saved plan. */
function readLegacyScopeGrid(onDiskJson: string | null): Record<string, unknown> | null {
  if (!onDiskJson) return null;
  try {
    const parsed: unknown = JSON.parse(onDiskJson);
    return isLegacyGridRoot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sortScopeGrid(grid: PreservedScopeGrid): PreservedScopeGrid {
  return Object.assign({}, Object.fromEntries(Object.keys(grid).sort().map((scope) => [scope, grid[scope]])));
}

/** Transpose membership, retaining stage order and initialization execution. */
export function transposeScopeGrid(stages: readonly Pick<WorkflowStage, "slug" | "phase" | "scopes">[], allowedScopes?: ReadonlySet<string>): ScopeGrid {
  const declaredScopes = stages.flatMap((stage) => stage.scopes ?? [])
    .filter((name) => allowedScopes === undefined || allowedScopes.has(name));
  const scopeNames = [...new Set([...declaredScopes, ...(allowedScopes ?? [])])].sort();
  // Assignment retains the legacy treatment of prototype-property names for
  // direct helper callers; validated stage and scope names avoid those keys.
  return Object.assign({}, Object.fromEntries(scopeNames.map((scope) => {
    const cells: Record<string, "EXECUTE" | "SKIP"> = Object.assign({}, Object.fromEntries(stages.map((stage): [string, "EXECUTE" | "SKIP"] => [
      stage.slug, stage.phase === "initialization" || (stage.scopes ?? []).includes(scope) ? "EXECUTE" : "SKIP",
    ])));
    return [scope, { stages: cells }];
  })));
}

/** Sole canonical scope-grid emitter, including preserved migration entries. */
export function canonicalScopeGridJson(grid: PreservedScopeGrid): string {
  return `${JSON.stringify(grid, null, 2)}\n`;
}

/** Fresh stock scopes win. Installed composed identities may retain their old
 * columns; an orphan cannot regain authority from a leftover grid entry. */
export interface ScopeMergeRequest {
  readonly fresh: ScopeGrid;
  readonly onDiskJson: string | null;
  readonly preserveNames?: ReadonlySet<string>;
}

export function mergeComposedScopes({ fresh, onDiskJson, preserveNames }: ScopeMergeRequest): PreservedScopeGrid {
  if (!onDiskJson) return fresh;
  const onDisk = readLegacyScopeGrid(onDiskJson);
  if (onDisk === null) return fresh;
  const legacyEntries = Object.entries(onDisk).flatMap(([name, entry]): Array<[string, PreservedScopeGrid[string]]> =>
    name in fresh || (preserveNames !== undefined && !preserveNames.has(name)) || !isLegacyScopeEntry(entry)
      ? [] : [[name, entry]],
  );
  const merged = { ...fresh, ...Object.fromEntries(legacyEntries) };
  return sortScopeGrid(merged);
}

export interface ComposedScopeSources {
  readonly records: Record<string, ComposedScopeRecord>;
  readonly onDiskJson: string | null;
  readonly stockScopeNames: ReadonlySet<string>;
  readonly installedScopeNames: ReadonlySet<string>;
}

export function composedFoldBack({ records, onDiskJson, stockScopeNames, installedScopeNames }: ComposedScopeSources): {
  json: string;
  names: ReadonlySet<string>;
  recordNames: ReadonlySet<string>;
  gridOnlyNames: ReadonlySet<string>;
} {
  const onDisk = readLegacyScopeGrid(onDiskJson) ?? {};
  const recordNames = new Set(Object.keys(records)
    .filter((name) => !stockScopeNames.has(name) && installedScopeNames.has(name)).sort());
  const gridOnlyNames = new Set(Object.keys(onDisk).filter((name) =>
    !stockScopeNames.has(name) && isScopeName(name) && installedScopeNames.has(name) && !recordNames.has(name),
  ).sort());
  const legacyEntries = [...gridOnlyNames].flatMap((name): Array<[string, PreservedScopeGrid[string]]> => {
    const entry = onDisk[name];
    return isLegacyScopeEntry(entry) ? [[name, entry]] : [];
  });
  const recordEntries = [...recordNames].map((name) => [name, { stages: records[name].stages }]);
  const merged: PreservedScopeGrid = Object.assign({}, Object.fromEntries(legacyEntries), Object.fromEntries(recordEntries));
  return {
    json: JSON.stringify(sortScopeGrid(merged)),
    names: new Set([...recordNames, ...gridOnlyNames].sort()), recordNames, gridOnlyNames,
  };
}

export function stageDeclaredScopeNames(stages: readonly Pick<WorkflowStage, "scopes">[]): ReadonlySet<string> {
  return new Set(stages.flatMap((stage) => stage.scopes ?? []));
}

interface ScopeSelection {
  readonly grid: PreservedScopeGrid;
  readonly allowedScopes: ReadonlySet<string> | null;
  readonly exemptScopes: ReadonlySet<string>;
}

function filterScopeGrid({ grid, allowedScopes, exemptScopes }: ScopeSelection): PreservedScopeGrid {
  if (allowedScopes === null) return grid;
  return Object.assign({}, Object.fromEntries(Object.keys(grid).sort()
    .filter((scope) => allowedScopes.has(scope) || exemptScopes.has(scope)).map((scope) => [scope, grid[scope]])));
}

/** Parse a numeric stage identifier like "3.5" into a tuple [phase, index]
 *  for total-ordering comparison. Returns negative, zero, or positive. */
export function numericStageOrder(left: string, right: string): number {
  const [leftPhase, leftIndex] = left.split(".").map((segment) => parseInt(segment, 10));
  const [rightPhase, rightIndex] = right.split(".").map((segment) => parseInt(segment, 10));
  if (leftPhase !== rightPhase) return leftPhase - rightPhase;
  return leftIndex - rightIndex;
}

/** Default display name for an auto-seeded stage: title-cased slug
 *  ("my-custom-stage" -> "My Custom Stage"). A one-time default only,
 *  compile pins it into stage-graph.json, so an author can refine the name
 *  there afterwards (e.g. "NFR Requirements") and the next compile keeps it. */
function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function stagePluginOwner(stage: Pick<WorkflowStage, "plugin">): string {
  return stage.plugin ?? "aidlc";
}

function validateSelectionClosure(stages: readonly WorkflowStage[], sourcePaths: ReadonlyMap<string, string>): void {
  const requiredInputs = stages.filter((stage) => stage.enabled !== false)
    .flatMap((stage) => stage.consumes.filter((consume) => consume.requirement === "required")
      .map((consume) => ({ stage, consume })));
  const unsatisfied = requiredInputs.map(({ stage, consume }) => ({ stage, consume,
    producers: stages.flatMap((producer) =>
      [...producer.produces, ...(producer.optionalProduces ?? [])]
        .filter((artifact) => artifact === consume.artifact).map(() => producer),
    ),
  })).find(({ producers }) => producers.length > 0 && producers.every((producer) => producer.enabled === false));
  if (unsatisfied === undefined) return;
  const { stage, consume, producers } = unsatisfied;
  const producerList = producers.map((producer) => `${producer.slug} (${stagePluginOwner(producer)})`).sort().join(", ");
  const disabledPlugins = [...new Set(producers.map(stagePluginOwner))].sort();
  throw new Error(
    `${sourcePaths.get(stage.slug)}: Plugin selection closure failed: enabled stage "${stage.slug}" consumes required artifact "${consume.artifact}", ` +
      `but its only producer(s) are disabled: ${producerList}. ` +
      `Enable plugin(s) ${disabledPlugins.join(", ")} or disable the consuming stage.`,
  );
}
