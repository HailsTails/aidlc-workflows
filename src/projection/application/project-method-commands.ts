import { refused } from "../../kernel/result.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { scopeColumn } from "../../workflow-definition/domain/scope-grid.ts";
import type { Harness, Rendering } from "./ports.ts";
import { collectCommandRenderings } from "./command-renderers.ts";

export const projectMethodCommands = (request: {
  readonly method: Method;
  readonly harness: Pick<Harness, "renderStageCommand" | "renderScopeCommand" | "renderOrchestratorSkill">;
}): Rendering => collectCommandRenderings([
  ...request.method.graph.nodes.map((node): Rendering => {
    const stage = request.method.stages.find((candidate) => candidate.slug === node.stage);
    return stage ? request.harness.renderStageCommand({ stage, node }) : refused({
      kind: "render-failed", concept: "stage-command", name: node.stage,
      reason: "The accepted graph references an absent stage.",
    });
  }),
  ...request.method.scopes.map((scope) => request.harness.renderScopeCommand({ scope,
    column: scopeColumn({ method: request.method, scope: scope.name }) })),
  request.harness.renderOrchestratorSkill({ method: request.method }),
]);
