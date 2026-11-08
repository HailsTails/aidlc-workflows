import type { Result } from "../../kernel/result.ts";
import type { DistributionId } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { NeutralSurface } from "../domain/neutral-surface.ts";
import type { Projection, ProjectionRefusal } from "../domain/projection.ts";

export type ProjectMethodRequest = {
  readonly harness: DistributionId;
  readonly method: Method;
  readonly surface: NeutralSurface;
};

export interface ProjectMethodForHarness {
  project(request: ProjectMethodRequest): Result<Projection, readonly ProjectionRefusal[]>;
}
