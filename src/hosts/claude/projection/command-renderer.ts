import type { FileContent, FileMode } from "../../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { Harness, Rendering } from "../../../projection/application/ports.ts";
import type { ProjectedFile } from "../../../projection/domain/projected-file.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

export type ClaudeCommandFile = { readonly nativeName: string; readonly within: string;
  readonly content: FileContent; readonly mode: FileMode };
export type ClaudeStageCommandLegacy = (
  request: Parameters<Harness["renderStageCommand"]>[0],
) => Result<readonly ClaudeCommandFile[] | null, ProjectionRefusal>;
export type ClaudeScopeCommandLegacy = (
  request: Parameters<Harness["renderScopeCommand"]>[0],
) => Result<readonly ClaudeCommandFile[] | null, ProjectionRefusal>;
export type ClaudeOrchestratorLegacy = (
  request: Parameters<Harness["renderOrchestratorSkill"]>[0],
) => Result<readonly ClaudeCommandFile[] | null, ProjectionRefusal>;
export type ClaudeCommandRenderers = Pick<Harness,
  "renderStageCommand" | "renderScopeCommand" | "renderOrchestratorSkill">;

const commandFiles = (request: {
  readonly concept: "stage-command" | "scope-command" | "orchestrator-skill";
  readonly name: string;
  readonly rendered: Result<readonly ClaudeCommandFile[] | null, ProjectionRefusal>;
}): Rendering => {
  if (!request.rendered.ok) return request.rendered;
  if (request.rendered.value === null) return accepted([]);
  const projected = request.rendered.value.map((file): Result<ProjectedFile, ProjectionRefusal> => {
    const name = request.concept === "orchestrator-skill" ? file.nativeName : request.name;
    const path = projectPath(`.claude/skills/${file.nativeName}/${file.within}`);
    return path.ok ? accepted({ path: path.value, mode: file.mode, availability: "always",
      content: file.content, origin: { kind: "rendered", concept: request.concept, name } })
      : refused({ kind: "render-failed", concept: request.concept, name,
        reason: "The native command destination must be a project-relative path." });
  });
  const failed = projected.find((admission) => !admission.ok);
  return failed && !failed.ok ? failed
    : accepted(projected.flatMap((admission) => admission.ok ? [admission.value] : []));
};

export const createClaudeCommandRenderers = (legacy: {
  readonly stage: ClaudeStageCommandLegacy;
  readonly scope: ClaudeScopeCommandLegacy;
  readonly orchestrator: ClaudeOrchestratorLegacy;
}): ClaudeCommandRenderers => ({
  renderStageCommand: (request) => commandFiles({ concept: "stage-command", name: request.stage.slug,
    rendered: legacy.stage(request) }),
  renderScopeCommand: (request) => commandFiles({ concept: "scope-command", name: request.scope.name,
    rendered: legacy.scope(request) }),
  renderOrchestratorSkill: (request) => commandFiles({ concept: "orchestrator-skill", name: "aidlc",
    rendered: legacy.orchestrator(request) }),
});
