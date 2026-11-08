import type { Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";

export type GuardId = Brand<string, "GuardId">;

export type GuardIdRefusal = { readonly kind: "invalid-guard-id"; readonly raw: string };

const GUARD_ID = /^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)?$/;

export const guardId = (raw: string): Result<GuardId, GuardIdRefusal> =>
  GUARD_ID.test(raw) ? accepted(raw as GuardId) : refused({ kind: "invalid-guard-id", raw });

export type GuardLift =
  | { readonly kind: "switch" }
  | { readonly kind: "override-once" }
  | { readonly kind: "locked"; readonly lockedIn: string };

export type GuardDeclaration = {
  readonly id: GuardId;
  readonly protects: string;
  readonly lift: GuardLift;
};

export type GuardInventory = readonly GuardDeclaration[];

const core = (id: string, protects: string, lift: GuardLift): GuardDeclaration => ({
  id: id as GuardId,
  protects,
  lift,
});

export const CORE_GUARDS = {
  planApproval: core(
    "plan-approval",
    "Code generation follows the plan the person approved.",
    { kind: "switch" },
  ),
  reviewFreeze: core(
    "review-freeze",
    "A reviewed artifact stays as it was reviewed.",
    { kind: "switch" },
  ),
  stateTransition: core(
    "state-transition",
    "Stations advance only through the engine.",
    { kind: "switch" },
  ),
  reviewerScope: core(
    "reviewer-scope",
    "A reviewer reads only what it reviews.",
    { kind: "switch" },
  ),
  humanPresence: core(
    "human-presence",
    "A gate hears the person's own words.",
    { kind: "override-once" },
  ),
  blockingCheck: core(
    "blocking-check",
    "A blocking check passes before its gate.",
    { kind: "override-once" },
  ),
} as const satisfies Readonly<Record<string, GuardDeclaration>>;

export type GuardRefusal = {
  readonly guard: GuardDeclaration;
  readonly reason: string;
  readonly nextStep: string;
};

export type GuardSwitch = {
  readonly guard: GuardId;
  readonly state: "on" | "off";
  readonly personWords: string;
  readonly at: Timestamp;
};
