import type {
  InstallationPlan,
  InstallationSnapshot,
  InstalledResource,
} from "../domain/installation.ts";
import { resourceKey } from "../domain/native-rendering.ts";
import type { ApplyFailure } from "../application/installation-writer.ts";
export type MemoryPlan = Pick<
  InstallationPlan,
  "conflicts" | "expectedRevision" | "expectedResources" | "changes"
>;
export type MemoryTransition =
  | { readonly status: "applied"; readonly snapshot: InstallationSnapshot }
  | ApplyFailure;
export const copyInstalledResource = (resource: InstalledResource): InstalledResource =>
  Object.freeze({
    ...resource,
    ownership:
      resource.ownership === null
        ? null
        : Object.freeze({
            ...resource.ownership,
            source: Object.freeze({ ...resource.ownership.source }),
          }),
  });

export const applyMemoryChanges = ({
  plan,
  snapshot,
}: {
  readonly plan: MemoryPlan;
  readonly snapshot: InstallationSnapshot;
}): MemoryTransition => {
  const { revision, resources } = snapshot;
  if (plan.conflicts.length > 0) return { status: "blocked", reason: "installation-conflicts" };
  if (plan.expectedRevision !== revision) return { status: "blocked", reason: "stale-snapshot" };
  if (plan.expectedResources !== JSON.stringify(resources))
    return { status: "blocked", reason: "snapshot-mismatch" };
  const removed = plan.changes.flatMap((change) =>
    change.action === "remove" ? [change.key] : [resourceKey(change.resource)],
  );
  const updatedResources = [
    ...resources.filter((resource) => !removed.includes(resourceKey(resource))),
    ...plan.changes.flatMap((change) =>
      change.action === "put" ? [copyInstalledResource(change.resource)] : [],
    ),
  ];

  return { status: "applied", snapshot: { revision: revision + 1, resources: updatedResources } };
};
