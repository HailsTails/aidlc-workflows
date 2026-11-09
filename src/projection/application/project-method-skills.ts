import type { Method } from "../../workflow-definition/domain/method.ts";
import type { SessionSkill } from "../domain/neutral-surface.ts";
import type { Harness, Rendering } from "./ports.ts";
import { collectCommandRenderings } from "./command-renderers.ts";
import { projectMethodCommands } from "./project-method-commands.ts";

export const projectMethodSkills = (request: {
  readonly method: Method;
  readonly commands: Pick<Harness, "renderStageCommand" | "renderScopeCommand" | "renderOrchestratorSkill">;
  readonly skills: Pick<Harness, "renderOrchestratorSkill" | "renderSessionSkill">;
  readonly sessions: readonly SessionSkill[];
}): Rendering => collectCommandRenderings([
  projectMethodCommands({ method: request.method, harness: {
    renderStageCommand: request.commands.renderStageCommand,
    renderScopeCommand: request.commands.renderScopeCommand,
    renderOrchestratorSkill: (entry) => collectCommandRenderings([
      request.commands.renderOrchestratorSkill(entry),
      request.skills.renderOrchestratorSkill(entry),
    ]),
  } }),
  ...request.sessions.map((skill) => request.skills.renderSessionSkill({ skill })),
]);
