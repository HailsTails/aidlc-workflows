import type { DistributionId, RelativePath } from "../../kernel/values.ts";
import type { VersionStamp } from "../../packaging/domain/payload.ts";
import type { HarnessProfile } from "../../projection/domain/harness-profile.ts";

export type InstalledDistribution = {
  readonly distribution: DistributionId;
  readonly harnessDirectory: RelativePath;
  readonly stamp: VersionStamp;
  readonly profile: HarnessProfile;
};

export type EnvironmentSnapshot = Readonly<Record<string, string | undefined>>;

export type CallingHarness =
  | { readonly kind: "sole"; readonly installed: InstalledDistribution }
  | { readonly kind: "marked"; readonly installed: InstalledDistribution }
  | { readonly kind: "guessed"; readonly installed: InstalledDistribution }
  | { readonly kind: "none-installed" };
