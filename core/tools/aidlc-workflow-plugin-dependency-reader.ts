import { existsSync, readFileSync } from "node:fs";
import {
  getField, isArchivedIntent, isCompletedIntent, listIntents, listSpaces,
  loadScopeMetadataAll, loadStageGraphAll, parseCheckboxes, stateFilePath,
  workflowDisplayName,
} from "./aidlc-lib.ts";
import { assessDependencies, type DependencyReason, type DependencySource } from "./workflow-plugin-dependencies/assessment.ts";
import { decodeOwnership, decodeState } from "./workflow-plugin-dependencies/persisted-records.ts";

export interface WorkflowPluginDiagnostic {
  plugin: string;
  workflow: string;
  text: string;
}
function dependencyDiagnostic(dependency: DependencyReason): WorkflowPluginDiagnostic {
  const where = `workflow "${dependency.workflow.name}" (space ${dependency.workflow.space})`;
  const requirement = dependency.kind === "scope"
    ? `runs under scope "${dependency.scope}"`
    : `has pending stage "${dependency.stage}"`;
  return {
    plugin: dependency.plugin,
    workflow: dependency.workflow.displayName,
    text: `${where} ${requirement} owned by plugin "${dependency.plugin}"`,
  };
}

export function activeWorkflowPluginDependencies(projectDir: string, enabled: ReadonlySet<string>): WorkflowPluginDiagnostic[] {
  const source: DependencySource = {
    ownership: () => decodeOwnership(
      Object.entries(loadScopeMetadataAll()).map(([name, meta]) => ({ name, plugin: meta.plugin })),
      loadStageGraphAll(),
    ),
    visitWorkflows: (visit) => {
      listSpaces(projectDir).forEach((space) => {
        listIntents(projectDir, space.name).forEach((intent) => {
          const identity = {
            space: space.name,
            name: intent.dirName || null,
            displayName: workflowDisplayName(space.name, intent),
          };
          const lifecycle = isCompletedIntent(intent) ? "completed" : isArchivedIntent(intent) ? "archived" : "other";
          visit({ identity, lifecycle, readState: (name) => {
            // The component invokes this only for a named, eligible candidate.
            const path = stateFilePath(projectDir, name, space.name);
            if (!existsSync(path)) return null;
            const content = readFileSync(path, "utf-8");
            return decodeState({ status: getField(content, "Status") ?? "", scope: getField(content, "Scope"), rows: parseCheckboxes(content) });
          } });
        });
      });
    },
  };
  return assessDependencies(source, enabled).map(dependencyDiagnostic);
}
