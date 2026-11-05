import { finding, selectionFor, sourceKey, type DocumentSource, type Finding } from "./model.ts";
import { resourceKey, type NativeContribution, type NativeResource } from "./native-rendering.ts";

export type Ownership = {
  readonly harness: string;
  readonly unit: string;
  readonly source: DocumentSource;
  readonly body: string;
};
export type InstalledResource = NativeResource & { readonly ownership: Ownership | null };
export type InstallationSnapshot = {
  readonly revision: number;
  readonly resources: readonly InstalledResource[];
};
export type Change =
  | { readonly action: "put"; readonly resource: InstalledResource }
  | { readonly action: "remove"; readonly key: string };
export type InstallationDecisionInput = {
  readonly harness: string;
  readonly selectedPlugins: readonly string[];
  readonly bundles: readonly NativeContribution[];
  readonly snapshot: InstallationSnapshot;
  readonly policy: "preserve" | "reconcile";
};
type Decision = { readonly changes: readonly Change[]; readonly conflicts: readonly Finding[] };
type DesiredResource = NativeResource & { readonly ownership: Ownership };

const desiredResources = (input: InstallationDecisionInput): readonly DesiredResource[] =>
  input.bundles
    .filter(
      (bundle) =>
        selectionFor({ source: bundle.source, plugins: input.selectedPlugins }) === "selected",
    )
    .flatMap((bundle) =>
      bundle.resources.map((resource) => ({
        ...resource,
        ownership: {
          harness: bundle.harness,
          unit: bundle.unit,
          source: bundle.source,
          body: resource.body,
        },
      })),
    );

const collisionFindings = ({
  resources,
}: {
  readonly resources: readonly NativeResource[];
}): readonly Finding[] => {
  const keys = resources.map(resourceKey);
  return [...new Set(keys)]
    .filter((key) => keys.filter((identity) => identity === key).length > 1)
    .map((key) =>
      finding({
        code: "destination-collision",
        subject: key,
        detail: "multiple resources occupy one destination",
      }),
    );
};
const conflictDecision = (conflict: Finding): Decision => ({ changes: [], conflicts: [conflict] });
const putDecision = (resource: DesiredResource): Decision => ({
  changes: [{ action: "put", resource }],
  conflicts: [],
});
const keepDecision = (): Decision => ({ changes: [], conflicts: [] });

const desiredDecision = ({
  resource,
  input,
}: {
  readonly resource: DesiredResource;
  readonly input: InstallationDecisionInput;
}): Decision => {
  const key = resourceKey(resource);
  const current = input.snapshot.resources.find(
    (installedResource) => resourceKey(installedResource) === key,
  );
  if (current === undefined) return putDecision(resource);
  if (
    current.ownership?.harness !== input.harness ||
    current.ownership.unit !== resource.ownership.unit ||
    sourceKey(current.ownership.source) !== sourceKey(resource.ownership.source)
  )
    return conflictDecision(
      finding({
        code: "foreign-content",
        subject: key,
        detail: "destination is not owned by this contribution",
      }),
    );
  if (current.body !== current.ownership.body)
    return conflictDecision(
      finding({
        code: "modified-owned-content",
        subject: key,
        detail: "preserve the user's modification",
      }),
    );
  if (current.body === resource.body) return keepDecision();
  if (input.policy === "preserve")
    return conflictDecision(
      finding({
        code: "preserved-owned-content",
        subject: key,
        detail: "replacement requires reconcile policy",
      }),
    );
  return putDecision(resource);
};

const obsoleteDecision = ({
  resource,
  input,
}: {
  readonly resource: InstalledResource;
  readonly input: InstallationDecisionInput;
}): Decision => {
  if (
    input.policy === "preserve" &&
    resource.ownership !== null &&
    selectionFor({ source: resource.ownership.source, plugins: input.selectedPlugins }) ===
      "selected"
  )
    return keepDecision();
  const key = resourceKey(resource);
  if (resource.body !== resource.ownership?.body)
    return conflictDecision(
      finding({
        code: "modified-owned-content",
        subject: key,
        detail: "obsolete content has been modified",
      }),
    );
  return { changes: [{ action: "remove", key }], conflicts: [] };
};

export type InstallationDecision = {
  readonly changes: readonly Change[];
  readonly conflicts: readonly Finding[];
};
export const decideInstallation = (input: InstallationDecisionInput): InstallationDecision => {
  const desired = desiredResources(input);
  const keys = desired.map(resourceKey);
  const obsolete = input.snapshot.resources.filter(
    (resource) =>
      resource.ownership?.harness === input.harness && !keys.includes(resourceKey(resource)),
  );
  const decisions = [
    ...desired.map((resource) => desiredDecision({ resource, input })),
    ...obsolete.map((resource) => obsoleteDecision({ resource, input })),
  ];
  const collisions = [
    ...collisionFindings({ resources: desired }),
    ...collisionFindings({ resources: input.snapshot.resources }),
  ];
  const conflicts = [...collisions, ...decisions.flatMap((decision) => decision.conflicts)];
  return {
    changes: conflicts.length > 0 ? [] : decisions.flatMap((decision) => decision.changes),
    conflicts,
  };
};
