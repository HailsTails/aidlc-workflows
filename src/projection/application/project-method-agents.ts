import type { Harness, Rendering } from "./ports.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { collectCommandRenderings } from "./command-renderers.ts";

export const projectMethodAgents = (request: {
  readonly method: Method;
  readonly harness: Pick<Harness, "renderAgent" | "renderConductorAgent">;
}): Rendering => collectCommandRenderings([
  ...request.method.agents.map((agent) => request.harness.renderAgent({ agent,
    knowledge: request.method.knowledge })),
  request.harness.renderConductorAgent({ knowledge: request.method.knowledge }),
]);