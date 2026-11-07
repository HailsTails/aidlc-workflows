import { existsSync, readFileSync } from "node:fs";
import {
  getField,
  isArchivedIntent,
  isCompletedIntent,
  listIntents,
  listSpaces,
  loadScopeMetadataAll,
  loadStageGraphAll,
  parseCheckboxes,
  stateFilePath,
  workflowDisplayName,
} from "./aidlc-lib.ts";
import {
  workflowPluginDependencies,
  type WorkflowPluginDependency,
  type WorkflowPluginFacts,
} from "./aidlc-workflow-plugin-dependencies.ts";

export interface WorkflowPluginDiagnostic {
  plugin: string;
  workflow: string;
  text: string;
}

function dependencyDiagnostic(dependency: WorkflowPluginDependency): WorkflowPluginDiagnostic {
  const where = `workflow "${dependency.workflow.recordName}" (space ${dependency.workflow.space})`;
  const requirement = dependency.kind === "scope"
    ? `runs under scope "${dependency.scope}"`
    : `has pending stage "${dependency.stage}"`;
  return {
    plugin: dependency.plugin,
    workflow: dependency.workflow.displayName,
    text: `${where} ${requirement} owned by plugin "${dependency.plugin}"`,
  };
}

export function activeWorkflowPluginDependencies(
  projectDir: string,
  enabled: ReadonlySet<string>,
): WorkflowPluginDiagnostic[] {
  const ownership = {
    scopes: Object.entries(loadScopeMetadataAll()).map(([name, meta]) => ({ name, plugin: meta.plugin })),
    stages: loadStageGraphAll(),
  };
  const workflows = listSpaces(projectDir).flatMap((space) =>
    listIntents(projectDir, space.name).map((intent): WorkflowPluginFacts => {
      const identity = {
        space: space.name,
        recordName: intent.dirName || null,
        displayName: workflowDisplayName(space.name, intent),
        registryClosed: isCompletedIntent(intent) || isArchivedIntent(intent),
      };
      if (identity.registryClosed || !intent.dirName) return { ...identity, state: null };
      const path = stateFilePath(projectDir, intent.dirName, space.name);
      if (!existsSync(path)) return { ...identity, state: null };
      const content = readFileSync(path, "utf-8");
      return {
        ...identity,
        state: {
          status: getField(content, "Status") ?? "",
          scope: getField(content, "Scope"),
          stages: parseCheckboxes(content),
        },
      };
    }),
  );
  return workflowPluginDependencies({ enabled, ownership, workflows }).map(dependencyDiagnostic);
}
