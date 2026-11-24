import { accepted } from "../../kernel/result.ts";
import { distributionId, projectPath } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { BuildProjection } from "./ports/build-projection.ts";
import type { CapturedMethodCompiler } from "./ports/captured-host.ts";

export const createCapturedMethodCompiler = (ports: {
  readonly method: Method; readonly serializeMethod: BuildProjection["serializeMethod"];
}): CapturedMethodCompiler => (target) => {
  const distribution = distributionId(target.name);
  if (!distribution.ok) return distribution;
  const directory = projectPath(target.directory);
  if (!directory.ok) return directory;
  const memoryRoot = projectPath(target.memoryRoot);
  return memoryRoot.ok ? accepted(ports.serializeMethod({ method: ports.method,
    host: { distribution: distribution.value, directory: directory.value }, memoryRoot: memoryRoot.value })) : memoryRoot;
};
