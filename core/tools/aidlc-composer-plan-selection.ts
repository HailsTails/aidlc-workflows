type PlanIdentity = {
  readonly scope: string;
  readonly changes: { readonly skip: readonly string[]; readonly add: readonly string[] };
  readonly projectType?: string;
  readonly depth?: string;
  readonly settings?: Readonly<Record<string, string | undefined>>;
  readonly guardPolicy?: string;
};

type TimedPlan = { readonly at?: string };

export function compareComposerPlans({ left, right }: { left: PlanIdentity; right: PlanIdentity }): "same-plan" | "different-plan" {
  const identityKey = (plan: PlanIdentity): string => JSON.stringify([
    plan.scope, [...plan.changes.skip].sort(), [...plan.changes.add].sort(), plan.projectType ?? null, plan.depth ?? null,
    Object.entries(plan.settings ?? {}).sort(([leftSetting], [rightSetting]) => leftSetting.localeCompare(rightSetting)), plan.guardPolicy ?? null,
  ]);
  return identityKey(left) === identityKey(right) ? "same-plan" : "different-plan";
}

export function composerPlansShown<Plan extends TimedPlan>({ plan, earlier, observeReply }: {
  plan: Plan;
  earlier: readonly Plan[];
  observeReply: (request: { at: string }) => "reply-observed" | "reply-not-observed";
}): { shown: Plan | null; unseen: Plan | null } {
  const plans = [...earlier, plan];
  const shown = plans.findLastIndex((entry) => entry.at === undefined || observeReply({ at: entry.at }) === "reply-observed");
  return { shown: plans[shown] ?? null, unseen: shown < plans.length - 1 ? plan : null };
}
