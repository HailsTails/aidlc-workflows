import type { FrameworkVersion } from "../../kernel/values.ts";
import type { DistributionDescriptor } from "../../packaging/domain/payload.ts";

export type InstalledDistribution = {
  readonly version: FrameworkVersion;
  readonly descriptor: DistributionDescriptor;
};

export type CallingHarness =
  | { readonly kind: "sole"; readonly installed: InstalledDistribution }
  | { readonly kind: "marked"; readonly installed: InstalledDistribution }
  | { readonly kind: "guessed"; readonly installed: InstalledDistribution }
  | { readonly kind: "none-installed" };
