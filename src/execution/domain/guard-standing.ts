import type { GuardPolicy } from "../../workflow-definition/domain/vocabulary.ts";
import {
  CORE_GUARDS,
  type GuardDeclaration,
  type GuardId,
  type GuardRefusal,
  type GuardSwitch,
} from "./guard.ts";

export type PolicyLock =
  | { readonly kind: "unlocked" }
  | { readonly kind: "locked"; readonly lockedIn: string };

export type GuardContext = {
  readonly policy: GuardPolicy;
  readonly lock: PolicyLock;
  readonly switches: readonly GuardSwitch[];
  readonly machineLowered: readonly GuardId[];
};

export type StandAsideReason =
  | { readonly kind: "machine-switch" }
  | { readonly kind: "switched-off"; readonly change: GuardSwitch }
  | { readonly kind: "policy"; readonly policy: GuardPolicy };

export type GuardStanding =
  | { readonly kind: "standing" }
  | { readonly kind: "stood-aside"; readonly because: StandAsideReason };

export type GuardVerdict =
  | { readonly kind: "holds"; readonly refusal: GuardRefusal }
  | {
      readonly kind: "stands-aside";
      readonly guard: GuardDeclaration;
      readonly because: StandAsideReason;
    };

const RELAXED_LOWERS: readonly GuardId[] = [
  CORE_GUARDS.planApproval.id,
  CORE_GUARDS.reviewFreeze.id,
];

const POLICY_LOWERS: Readonly<Record<GuardPolicy, readonly GuardId[]>> = {
  strict: [],
  relaxed: RELAXED_LOWERS,
  off: [...RELAXED_LOWERS, CORE_GUARDS.stateTransition.id, CORE_GUARDS.reviewerScope.id],
};

const STANDING: GuardStanding = { kind: "standing" };

const latestSwitch = (
  guard: GuardDeclaration,
  switches: readonly GuardSwitch[],
): GuardSwitch | undefined => switches.filter((change) => change.guard === guard.id).at(-1);

const switchStanding = (guard: GuardDeclaration, context: GuardContext): GuardStanding => {
  const change = latestSwitch(guard, context.switches);
  return guard.lift.kind === "switch" && change?.state === "off"
    ? { kind: "stood-aside", because: { kind: "switched-off", change } }
    : STANDING;
};

const policyStanding = (guard: GuardDeclaration, policy: GuardPolicy): GuardStanding =>
  POLICY_LOWERS[policy].includes(guard.id)
    ? { kind: "stood-aside", because: { kind: "policy", policy } }
    : STANDING;

const unlockedStanding = (guard: GuardDeclaration, context: GuardContext): GuardStanding => {
  const switched = switchStanding(guard, context);
  const latest = latestSwitch(guard, context.switches);
  if (switched.kind === "stood-aside" || latest?.state === "on") {
    return switched;
  }
  return policyStanding(guard, context.policy);
};

export const standingOf = (guard: GuardDeclaration, context: GuardContext): GuardStanding => {
  if (context.machineLowered.includes(guard.id)) {
    return { kind: "stood-aside", because: { kind: "machine-switch" } };
  }
  return context.lock.kind === "locked" ? STANDING : unlockedStanding(guard, context);
};

export const liftUnder = (guard: GuardDeclaration, lock: PolicyLock): GuardDeclaration =>
  lock.kind === "locked" && guard.lift.kind === "switch"
    ? { ...guard, lift: { kind: "locked", lockedIn: lock.lockedIn } }
    : guard;

export const enforce = (refusal: GuardRefusal, context: GuardContext): GuardVerdict => {
  const standing = standingOf(refusal.guard, context);
  return standing.kind === "standing"
    ? { kind: "holds", refusal: { ...refusal, guard: liftUnder(refusal.guard, context.lock) } }
    : { kind: "stands-aside", guard: refusal.guard, because: standing.because };
};
