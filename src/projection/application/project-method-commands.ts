import { graphEntries, type Method } from "../../workflow-definition/domain/method.ts";
import { scopeColumn } from "../../workflow-definition/domain/scope-grid.ts";
import type { Harness, Rendering } from "./ports.ts";
import { collectCommandRenderings } from "./command-renderers.ts";

export const renderStageAndScopeCommands = (request: {
  readonly method: Method;
  readonly harness: Pick<Harness, "renderStageCommand" | "renderScopeCommand">;
}): readonly Rendering[] => [
  ...graphEntries(request.method).map((entry) => request.harness.renderStageCommand(entry)),
  ...request.method.scopes.map((scope) => request.harness.renderScopeCommand({ scope,
    column: scopeColumn({ method: request.method, scope: scope.name }) })),
];

export const projectMethodCommands = (request: {
  readonly method: Method;
  readonly harness: Pick<Harness, "renderStageCommand" | "renderScopeCommand" | "renderOrchestratorSkill">;
}): Rendering => collectCommandRenderings([
  ...renderStageAndScopeCommands(request),
  request.harness.renderOrchestratorSkill({ method: request.method }),
]);
