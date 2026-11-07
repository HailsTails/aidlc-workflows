import { loadScopeMapping, loadStageGraph, validScopes } from "./aidlc-lib.ts";
import { aidlcDispatcherInvocation } from "./aidlc-runtime-paths.ts";

export const SCOPE_TABLE_BEGIN =
  `<!-- BEGIN: compiled scope grid via \`${aidlcDispatcherInvocation("gen scope-table")}\` - do NOT hand-edit -->`;
export const SCOPE_TABLE_END =
  "<!-- END: compiled scope grid -->";

/** Exported for t67 unit tests. */
export function renderScopeTable(): string {
  const mapping = loadScopeMapping();
  const scopes = [...validScopes()]; // alphabetical
  const lines = [
    "| Scope          | Depth         | TestStrategy | EXECUTE / Total |",
    "|----------------|---------------|--------------|-----------------|",
  ];
  for (const name of scopes) {
    const def = mapping[name];
    const stages = def.stages;
    const total = Object.keys(stages).length;
    const execute = Object.values(stages).filter((v) => v === "EXECUTE").length;
    const depth = def.depth;
    const ts = def.testStrategy ?? "(default)";
    lines.push(
      `| ${name.padEnd(14)} | ${depth.padEnd(13)} | ${ts.padEnd(12)} | ${`${execute} / ${total}`.padEnd(15)} |`
    );
  }
  return lines.join("\n");
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
  return Array.isArray(agents) && agents.length > 0 ? agents.join(", ") : "—";
}

/** Exported for t32 integration tests. */
export function renderStageTable(): string {
  const lines = [
    "| Slug | # | Stage | Phase | Execution | Lead Agent | Support Agents | Mode |",
    "|------|---|-------|-------|-----------|------------|----------------|------|",
  ];
  for (const stage of loadStageGraph()) {
    lines.push(
      `| ${stage.slug} | ${stage.number} | ${stage.name} | ${displayPhase(stage.phase)} | ${stage.execution} | ${displayLeadAgent(stage.lead_agent)} | ${displaySupportAgents(stage.support_agents)} | ${stage.mode} |`
    );
  }
  return lines.join("\n");
}

/** Canonical byte-shape: BEGIN\n\n<table>\n\nEND. */
export function canonicalStageTableRegion(table: string): string {
  return `${STAGE_TABLE_BEGIN}\n\n${table}\n\n${STAGE_TABLE_END}`;
}
