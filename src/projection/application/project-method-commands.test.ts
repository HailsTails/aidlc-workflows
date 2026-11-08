import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import type { Rendering } from "./ports.ts";
import { projectMethodCommands } from "./project-method-commands.ts";

test("the command substep visits the compiled stages, scopes and orchestrator exactly once", () => {
  const stage = mock((): Rendering => accepted([]));
  const scope = mock((): Rendering => accepted([]));
  const orchestrator = mock((): Rendering => accepted([]));
  expect(projectMethodCommands({ method: methodSliceFixture, harness: {
    renderStageCommand: stage, renderScopeCommand: scope, renderOrchestratorSkill: orchestrator,
  } })).toEqual(accepted([]));
  expect(stage).toHaveBeenCalledTimes(3);
  expect(scope).toHaveBeenCalledTimes(2);
  expect(orchestrator).toHaveBeenCalledTimes(1);
});

test("the command use case returns a scope failure before any writer is involved", () => {
  const renderer = { renderStageCommand: (): Rendering => accepted([]),
    renderScopeCommand: (): Rendering => refused({ kind: "render-failed", concept: "scope-command",
      name: "feature", reason: "Scope source missing" }),
    renderOrchestratorSkill: (): Rendering => accepted([]) };
  expect(projectMethodCommands({ method: methodSliceFixture, harness: renderer })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature", reason: "Scope source missing" } });
});
