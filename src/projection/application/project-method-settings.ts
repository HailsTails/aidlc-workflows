import type { Method } from "../../workflow-definition/domain/method.ts";
import type { Harness, Rendering } from "./ports.ts";
import { collectCommandRenderings } from "./command-renderers.ts";

export const renderMethodSettings = (request: {
  readonly method: Method;
  readonly harness: Pick<Harness, "renderSettings" | "renderHookRegistrations">;
}): readonly Rendering[] => [
  request.harness.renderSettings({ method: request.method }),
  request.harness.renderHookRegistrations({ hooks: request.method.hooks }),
];

export const projectMethodSettings = (request: {
  readonly method: Method;
  readonly harness: Pick<Harness, "renderSettings" | "renderHookRegistrations">;
}): Rendering => collectCommandRenderings(renderMethodSettings(request));
