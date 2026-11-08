import type { Timestamp } from "../../kernel/values.ts";

export const GUARD_IDS = [
  "plan-approval",
  "review-freeze",
  "state-transition",
  "reviewer-scope",
  "human-presence",
  "blocking-check",
] as const;

export type GuardId = (typeof GUARD_IDS)[number];

export type SwitchableGuardId = Exclude<GuardId, "human-presence" | "blocking-check">;

export type GuardLift =
  | { readonly kind: "switch"; readonly guard: SwitchableGuardId }
  | { readonly kind: "override-once" }
  | { readonly kind: "locked"; readonly lockedIn: string };

export type Guard = {
  readonly id: GuardId;
  readonly protects: string;
  readonly lift: GuardLift;
};

export type GuardRefusal = {
  readonly guard: GuardId;
  readonly reason: string;
  readonly nextStep: string;
  readonly lift: GuardLift;
};

export type GuardSwitch = {
  readonly guard: SwitchableGuardId;
  readonly state: "on" | "off";
  readonly personWords: string;
  readonly at: Timestamp;
};
