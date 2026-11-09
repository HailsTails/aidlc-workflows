import { expect, mock, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { path, source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import type { Rendering } from "./ports.ts";
import { projectMethodAgents } from "./project-method-agents.ts";

test("the agent projection calls the conductor once beside each Method persona", () => {
  const persona = mock((): Rendering => accepted([]));
  const conductor = mock((): Rendering => accepted([]));
  expect(projectMethodAgents({ method: methodSliceFixture,
    harness: { renderAgent: persona, renderConductorAgent: conductor } })).toEqual(accepted([]));
  expect(persona).toHaveBeenCalledTimes(6);
  expect(conductor).toHaveBeenCalledTimes(1);
  expect(conductor).toHaveBeenCalledWith({ knowledge: methodSliceFixture.knowledge });
});

test("personas and conductor use the existing collision owner", () => {
  const personaOrigin = { kind: "method-source", path: methodSource({ kind: "agent", within: "persona.md" }) } as const;
  const conductorOrigin = { kind: "harness-authored", source: source("agents/conductor.json") } as const;
  const destination = path(".native/agents/shared.json");
  const file = { path: destination, mode: "regular", availability: "always",
    content: { kind: "text", text: "final bytes" } } as const;
  const persona = mock((): Rendering => accepted([]))
    .mockReturnValueOnce(accepted([{ ...file, origin: personaOrigin }]));
  expect(projectMethodAgents({ method: methodSliceFixture,
    harness: { renderAgent: persona,
      renderConductorAgent: () => accepted([{ ...file, origin: conductorOrigin }]) } }))
    .toEqual({ ok: false, refusal: { kind: "path-collision", path: destination,
      origins: [personaOrigin, conductorOrigin] } });
});