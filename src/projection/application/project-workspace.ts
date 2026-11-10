import { accepted, refused } from "../../kernel/result.ts";
import { projectPath } from "../../kernel/values.ts";
import { METHOD_SOURCE_FOLDERS } from "../../workflow-definition/domain/method-source.ts";
import { DEFAULT_WORKSPACE } from "../domain/workspace.ts";
import { bindCopiedSource } from "../domain/source-binding.ts";
import { collectCommandRenderings } from "./command-renderers.ts";
import type { WorkspaceProjection, WorkspaceProjectionRequest } from "./ports/workspace.ts";
import type { Rendering } from "./ports/harness.ts";
import type { MemoryCopy } from "../domain/projected-file.ts";

const memoryFile = ({ workspace, rule, copy }: {
  readonly workspace: WorkspaceProjectionRequest;
  readonly rule: WorkspaceProjectionRequest["rules"][number];
  readonly copy: MemoryCopy;
}): Rendering => {
  const root = copy === "space" ? DEFAULT_WORKSPACE.memory : `${workspace.host.directory}/${DEFAULT_WORKSPACE.seed}`;
  const path = projectPath(`${root}/${rule.path.slice(METHOD_SOURCE_FOLDERS.rule.length + 1)}`);
  return path.ok ? accepted([{ path: path.value,
    content: bindCopiedSource({ source: rule.path, content: rule.content, tokens: workspace.tokens }),
    mode: "regular", availability: "always", origin: { kind: "workspace-memory", copy, path: rule.path } }])
    : refused({ kind: "render-failed", concept: "host-data", name: rule.path,
      reason: "The workspace memory destination must be project-relative." });
};

const companionFile = ({ workspace, companion, copy }: {
  readonly workspace: WorkspaceProjectionRequest;
  readonly companion: WorkspaceProjectionRequest["companions"][number];
  readonly copy: MemoryCopy;
}): Rendering => {
  const root = copy === "space" ? DEFAULT_WORKSPACE.memory : `${workspace.host.directory}/${DEFAULT_WORKSPACE.seed}`;
  const path = projectPath(`${root}/${companion.source.slice(METHOD_SOURCE_FOLDERS.rule.length + 1)}`);
  return path.ok ? accepted([{ path: path.value, content: companion.content,
    mode: "regular", availability: "always", origin: { kind: "memory-companion", copy, source: companion.source } }])
    : refused({ kind: "render-failed", concept: "host-data", name: companion.source,
      reason: "The workspace memory destination must be project-relative." });
};

export const projectWorkspace: WorkspaceProjection = (request) => {
  const pointer = projectPath(DEFAULT_WORKSPACE.activeSpace);
  if (!pointer.ok) return refused({ kind: "render-failed", concept: "host-data", name: DEFAULT_WORKSPACE.activeSpace,
    reason: "The active-space pointer must be project-relative." });
  return collectCommandRenderings([
    ...request.rules.flatMap((rule) => [memoryFile({ workspace: request, rule, copy: "space" }),
      memoryFile({ workspace: request, rule, copy: "seed" })]),
    ...request.companions.flatMap((companion) => [companionFile({ workspace: request, companion, copy: "space" }),
      companionFile({ workspace: request, companion, copy: "seed" })]),
    accepted([{ path: pointer.value, content: { kind: "text", text: `${DEFAULT_WORKSPACE.name}\n` },
      mode: "regular", availability: "always", origin: { kind: "active-space" } }]),
  ]);
};
