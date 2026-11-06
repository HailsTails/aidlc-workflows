import type { InstallationPlan, InstallationSnapshot } from "../domain/installation.ts";
export type ApplyFailureReason =
  | "unvalidated-plan"
  | "installation-conflicts"
  | "stale-snapshot"
  | "snapshot-mismatch";
export type ApplyFailure = {
  [Reason in ApplyFailureReason]: { readonly status: "blocked"; readonly reason: Reason };
}[ApplyFailureReason];
export type ApplyOutcome =
  | {
      readonly status: "applied";
      readonly revision: number;
    }
  | ApplyFailure;
export type InstallationWriter = {
  readonly snapshot: () => InstallationSnapshot;
  readonly apply: (plan: InstallationPlan) => ApplyOutcome;
};
