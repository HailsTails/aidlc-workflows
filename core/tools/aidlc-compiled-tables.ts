import { loadScopeMapping, loadStageGraph, validScopes } from "./aidlc-lib.ts";
import type { ScopeDefinition, StageEntry } from "./aidlc-lib.ts";
import { aidlcDispatcherInvocation } from "./aidlc-runtime-paths.ts";

export interface ScopeTableSources {
  mapping: () => Readonly<Record<string, Pick<ScopeDefinition, "depth" | "stages" | "testStrategy">>>;
  scopes: () => ReadonlySet<string>;
}

type TableStage = Pick<StageEntry,
  "slug" | "number" | "name" | "phase" | "execution" | "mode"
> & {
  leadAgent: StageEntry["lead_agent"];
  supportAgents: StageEntry["support_agents"];
};

function installedStageRows(): readonly TableStage[] {
  return loadStageGraph().map((stage) => ({
    slug: stage.slug,
    number: stage.number,
    name: stage.name,
    phase: stage.phase,
    execution: stage.execution,
    leadAgent: stage.lead_agent,
    supportAgents: stage.support_agents,
    mode: stage.mode,
  }));
}

function installedScopeSources(): ScopeTableSources {
  return { mapping: loadScopeMapping, scopes: validScopes };
}

export const SCOPE_TABLE_BEGIN =
  `<!-- BEGIN: compiled scope grid via \`${aidlcDispatcherInvocation("gen scope-table")}\` - do NOT hand-edit -->`;
export const SCOPE_TABLE_END =
  "<!-- END: compiled scope grid -->";

export function renderScopeTable(sources: ScopeTableSources = installedScopeSources()): string {
  const mapping = sources.mapping();
  const rows = [...sources.scopes()].map((name) => {
    // validScopes derives its names from the same cached mapping.
    const definition = mapping[name]!;
    const stages = definition.stages;
    const total = Object.keys(stages).length;
    const execute = Object.values(stages).filter((execution) => execution === "EXECUTE").length;
    const depth = definition.depth;
    const strategy = definition.testStrategy ?? "(default)";
    return `| ${name.padEnd(14)} | ${depth.padEnd(13)} | ${strategy.padEnd(12)} | ${`${execute} / ${total}`.padEnd(15)} |`;
  });
  return [
    "| Scope          | Depth         | TestStrategy | EXECUTE / Total |",
    "|----------------|---------------|--------------|-----------------|",
    ...rows,
  ].join("\n");
}

/** Canonical byte-shape: BEGIN\n\n<table>\n\nEND. */
export function canonicalScopeTableRegion(table: string): string {
  return `${SCOPE_TABLE_BEGIN}\n\n${table}\n\n${SCOPE_TABLE_END}`;
}

export const STAGE_TABLE_BEGIN =
  `<!-- BEGIN: compiled stage graph via \`${aidlcDispatcherInvocation("gen stage-table")}\` - do NOT hand-edit -->`;
export const STAGE_TABLE_END =
  "<!-- END: compiled stage graph -->";

function displayPhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function displayLeadAgent(agent: string): string {
  return agent === "orchestrator" ? "(orchestrator)" : agent;
}

function displaySupportAgents(agents: string[] | undefined): string {
  return Array.isArray(agents) && agents.length > 0 ? agents.join(", ") : "\u2014";
}

export function renderStageTable(stages: () => readonly TableStage[] = installedStageRows): string {
  return [
    "| Slug | # | Stage | Phase | Execution | Lead Agent | Support Agents | Mode |",
    "|------|---|-------|-------|-----------|------------|----------------|------|",
    ...stages().map((stage) =>
      `| ${stage.slug} | ${stage.number} | ${stage.name} | ${displayPhase(stage.phase)} | ${stage.execution} | ${displayLeadAgent(stage.leadAgent)} | ${displaySupportAgents(stage.supportAgents)} | ${stage.mode} |`
    ),
  ].join("\n");
}

/** Canonical byte-shape: BEGIN\n\n<table>\n\nEND. */
export function canonicalStageTableRegion(table: string): string {
  return `${STAGE_TABLE_BEGIN}\n\n${table}\n\n${STAGE_TABLE_END}`;
}
