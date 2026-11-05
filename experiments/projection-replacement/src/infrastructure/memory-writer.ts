import { applyMemoryChanges, copyInstalledResource } from "./memory-installation.ts";
import {
  isInstallationPlan,
  type InstallationPlan,
  type InstallationSnapshot,
  type InstalledResource,
} from "../domain/installation.ts";
import type { ApplyOutcome, InstallationWriter } from "../application/installation-writer.ts";
export const createMemoryWriter = ({
  initial = [],
}: {
  readonly initial?: readonly InstalledResource[];
} = {}): InstallationWriter => {
  let snapshot: InstallationSnapshot = {
    revision: 0,
    resources: initial.map(copyInstalledResource),
  };
  return Object.freeze({
    snapshot: () =>
      Object.freeze({
        revision: snapshot.revision,
        resources: Object.freeze([...snapshot.resources]),
      }),
    apply: (plan: InstallationPlan): ApplyOutcome => {
      if (!isInstallationPlan({ candidate: plan }))
        return { status: "blocked", reason: "unvalidated-plan" };
      const applied = applyMemoryChanges({ plan, snapshot });
      if (applied.status === "blocked") return applied;
      snapshot = applied.snapshot;
      return { status: "applied", revision: snapshot.revision };
    },
  });
};
