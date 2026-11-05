import { sensorSourceFromFile } from "./aidlc-workflow-wire.ts";
// Filesystem adapter for a staged workflow definition. Every input location is
// explicit. This reads and captures values; it never binds a process-global
// project, clears runtime caches, or writes a graph/identity/ledger.
import { filesystemWorkflowSourceReader, type WorkflowSourceReader } from "./aidlc-workflow-source-reader.ts";
import { loadComposedScopeRecords, loadRules, loadSensors } from "./aidlc-graph.ts";
import { readAgents, readPluginSelection, readScopeMetadata, readStageGraph, selectScopeMetadata } from "./aidlc-lib.ts";
import { freezeWorkflowValue, type WorkflowCompilationRequest } from "./aidlc-workflow-candidate.ts";

export interface WorkflowCandidatePaths {
  readonly stagesDir: string;
  readonly stageGraphPath: string;
  readonly scopeGridPath: string;
  readonly scopesDir: string;
  readonly composedScopesDir: string;
  readonly rulesDir: string;
  readonly sensorsDir: string;
  readonly agentsDir: string;
  readonly harnessDataPath: string;
  /** Display prefix baked into sensor bindings, not a filesystem root. */
  readonly harnessDir: string;
}

export function readWorkflowCompilationRequest(
  paths: WorkflowCandidatePaths,
  sources: WorkflowSourceReader = filesystemWorkflowSourceReader,
): WorkflowCompilationRequest {
  const stageSources = sources.stageSources(paths.stagesDir);
  const selectedPlugins = readPluginSelection(paths.harnessDataPath);
  const allScopes = readScopeMetadata(paths.scopesDir);
  const selectedScopes = selectScopeMetadata(allScopes, selectedPlugins);
  const rules = loadRules({ directory: paths.rulesDir }).map(({ path, scope, phase }) => ({ path, scope, phase }));
  return freezeWorkflowValue({
    stageSources,
    existingStages: readStageGraph(paths.stageGraphPath).map(({ slug, number, name }) => ({ slug, number, name })),
    knownAgents: readAgents(paths.agentsDir).map((agent) => agent.slug),
    rules,
    sensors: [...loadSensors({ directory: paths.sensorsDir, harnessDir: paths.harnessDir }).values()].map(sensorSourceFromFile),
    selectedPlugins: selectedPlugins === null ? null : [...selectedPlugins],
    selectedScopeNames: selectedPlugins === null ? null : Object.keys(selectedScopes),
    installedScopeNames: Object.keys(allScopes),
    composedRecords: loadComposedScopeRecords({ directory: paths.composedScopesDir }),
    priorGridJson: sources.priorGridText(paths.scopeGridPath),
  });
}
