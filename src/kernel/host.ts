import type { DistributionId, ProjectPath } from "./values.ts";

export type HostIdentity = {
  readonly distribution: DistributionId;
  readonly directory: ProjectPath;
};
