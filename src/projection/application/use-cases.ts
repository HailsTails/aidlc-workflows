import type { AuthoredHostFile } from "../domain/host-surface.ts";
import type { Result } from "../../kernel/result.ts";
import type { DistributionId } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { MethodSource } from "../../workflow-definition/domain/method-source.ts";
import type { NeutralSurface, SharedRuntime } from "../domain/neutral-surface.ts";
import type { Projection, ProjectionRefusal } from "../domain/projection.ts";

export type ProjectMethodRequest = {
  readonly harness: DistributionId;
  readonly method: Method;
  readonly sources: readonly MethodSource[];
  readonly surface: NeutralSurface;
  readonly hostFiles: readonly AuthoredHostFile[];
  readonly runtime: SharedRuntime;
};

export interface ProjectMethodForHarness {
  project(request: ProjectMethodRequest): Result<Projection, readonly ProjectionRefusal[]>;
}
