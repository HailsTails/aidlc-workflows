import { finding, type Finding, type Outcome } from "./model.ts";
import { isNativeBundle, type NativeBundle } from "./integration.ts";
import {
  decideInstallation,
  type InstallationDecision,
  type InstallationDecisionInput,
  type Change,
} from "./installation-decision.ts";
export type {
  Ownership,
  InstalledResource,
  InstallationSnapshot,
  Change,
} from "./installation-decision.ts";
export type InstallationInput = Omit<InstallationDecisionInput, "bundles"> & {
  readonly bundles: readonly NativeBundle[];
};
const planned = Symbol("installation-plan");
export type InstallationPlan = {
  readonly [planned]: true;
  readonly harness: string;
  readonly selectedPlugins: readonly string[];
  readonly expectedRevision: number;
  readonly expectedResources: string;
  readonly changes: readonly Change[];
  readonly conflicts: readonly Finding[];
};
export type InstallationDependencies = {
  readonly accepts: (input: { readonly candidate: unknown }) => "accepted" | "rejected";
  readonly decide: typeof decideInstallation;
};
export const createInstallationDependencies = (): InstallationDependencies => ({
  accepts: (input) => (isNativeBundle(input) ? "accepted" : "rejected"),
  decide: decideInstallation,
});
const inputFindings = ({
  input,
  dependencies,
}: {
  readonly input: InstallationInput;
  readonly dependencies: InstallationDependencies;
}): readonly Finding[] => {
  const invalidBundles = input.bundles.flatMap<Finding>((bundle) =>
    dependencies.accepts({ candidate: bundle }) === "rejected"
      ? [
          finding({
            code: "unvalidated-bundle",
            subject: "installation",
            detail: "only native integration output is accepted",
          }),
        ]
      : bundle.harness !== input.harness
        ? [finding({ code: "harness-mismatch", subject: bundle.unit, detail: bundle.harness })]
        : [],
  );
  if (invalidBundles.length > 0) return invalidBundles;
  return input.selectedPlugins
    .filter(
      (id) =>
        !input.bundles.some((bundle) => bundle.source.kind === "plugin" && bundle.source.id === id),
    )
    .map((id) =>
      finding({
        code: "missing-plugin",
        subject: id,
        detail: "selected plugin has no native integration",
      }),
    );
};

const freezeChange = (change: Change): Change => {
  if (change.action === "remove") return Object.freeze(change);
  const ownership = change.resource.ownership;
  return Object.freeze({
    action: change.action,
    resource: Object.freeze({
      ...change.resource,
      ownership:
        ownership === null
          ? null
          : Object.freeze({ ...ownership, source: Object.freeze({ ...ownership.source }) }),
    }),
  });
};

const installationPlan = ({
  input,
  decision,
  plans,
}: {
  readonly input: InstallationInput;
  readonly decision: InstallationDecision;
  readonly plans: WeakSet<object>;
}): InstallationPlan => {
  const { conflicts } = decision;
  const plan = Object.freeze<InstallationPlan>({
    [planned]: true,
    harness: input.harness,
    selectedPlugins: Object.freeze([...input.selectedPlugins]),
    expectedRevision: input.snapshot.revision,
    expectedResources: JSON.stringify(input.snapshot.resources),
    changes: Object.freeze(conflicts.length > 0 ? [] : decision.changes.map(freezeChange)),
    conflicts: Object.freeze(conflicts.map((conflict) => Object.freeze(conflict))),
  });
  plans.add(plan);
  return plan;
};

export type InstallationPlanner = (input: InstallationInput) => Outcome<InstallationPlan>;
export const createInstallationPlanner = (
  dependencies: InstallationDependencies = createInstallationDependencies(),
): InstallationService => {
  const plans = new WeakSet<object>();
  const isInstallationPlan = (input: {
    readonly candidate: unknown;
  }): input is { readonly candidate: InstallationPlan } =>
    typeof input.candidate === "object" && input.candidate !== null && plans.has(input.candidate);
  const planInstallation: InstallationPlanner = (input) => {
    const findings = inputFindings({ input, dependencies });
    if (findings.length > 0) return { status: "invalid", findings };
    return {
      status: "ok",
      value: installationPlan({ input, decision: dependencies.decide(input), plans }),
    };
  };

  return Object.freeze({ planInstallation, isInstallationPlan });
};
export type InstallationService = {
  readonly planInstallation: InstallationPlanner;
  readonly isInstallationPlan: (input: {
    readonly candidate: unknown;
  }) => input is { readonly candidate: InstallationPlan };
};
const canonicalInstallation = createInstallationPlanner();
export const planInstallation = canonicalInstallation.planInstallation;
export const isInstallationPlan = canonicalInstallation.isInstallationPlan;
