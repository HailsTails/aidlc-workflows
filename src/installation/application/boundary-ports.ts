import type { DistributionId } from "../../kernel/values.ts";

export interface HostShell {
  markedDistribution(): DistributionId | null;
}
