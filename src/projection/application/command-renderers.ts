import { accepted, refused } from "../../kernel/result.ts";
import { ENTRY_SHORTCUTS, type CommandSubject } from "../domain/native-command.ts";
import type { CommandPlacement, CommandSource, Harness, Rendering } from "./ports.ts";

export const collectCommandRenderings = (renderings: readonly Rendering[]): Rendering => {
  const failed = renderings.find((rendering) => !rendering.ok);
  if (failed && !failed.ok) return failed;
  const files = renderings.flatMap((rendering) => rendering.ok ? rendering.value : []);
  const collision = files.flatMap((file, index) => files.slice(index + 1)
    .filter((other) => other.path === file.path).map((other) => ({ file, other })))[0];
  return collision ? refused({ kind: "path-collision", path: collision.file.path,
    origins: [collision.file.origin, collision.other.origin] }) : accepted(files);
};

const renderCommand = (request: {
  readonly source: CommandSource;
  readonly place: CommandPlacement;
  readonly subject: CommandSubject;
}): Rendering => {
  const rendered = request.source.read(request.subject);
  if (!rendered.ok) return rendered;
  if (rendered.value.kind === "declined") return accepted([]);
  return collectCommandRenderings(rendered.value.files.map((file): Rendering => {
    const path = request.place(file);
    return path.ok ? accepted([{ path: path.value, mode: file.mode, content: file.content,
      availability: "always", origin: { kind: "rendered", ...request.subject } }])
      : refused({ kind: "render-failed", ...request.subject,
        reason: "The native command destination must be a project-relative path." });
  }));
};

export const createCommandRenderers = (request: {
  readonly source: CommandSource;
  readonly place: CommandPlacement;
}): Pick<Harness, "renderStageCommand" | "renderScopeCommand" | "renderOrchestratorSkill"> => ({
  renderStageCommand: ({ stage }) => renderCommand({ ...request,
    subject: { concept: "stage-command", name: stage.slug } }),
  renderScopeCommand: ({ scope }) => renderCommand({ ...request,
    subject: { concept: "scope-command", name: scope.name } }),
  renderOrchestratorSkill: () => collectCommandRenderings(ENTRY_SHORTCUTS.map((name) =>
    renderCommand({ ...request, subject: { concept: "orchestrator-skill", name } }))),
});
