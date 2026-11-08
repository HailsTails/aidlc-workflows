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

const core = (declared: {
  readonly id: string;
  readonly protects: string;
  readonly lift: GuardLift;
}): GuardDeclaration => ({ ...declared, id: declared.id as GuardId });

export const CORE_GUARDS = {
  planApproval: core({
    id: "plan-approval",
    protects: "Code generation follows the plan the person approved.",
    lift: { kind: "switch" },
  }),
  reviewFreeze: core({
    id: "review-freeze",
    protects: "A reviewed artifact stays as it was reviewed.",
    lift: { kind: "switch" },
  }),
  stateTransition: core({
    id: "state-transition",
    protects: "Stations advance only through the engine.",
    lift: { kind: "switch" },
  }),
  reviewerScope: core({
    id: "reviewer-scope",
    protects: "A reviewer reads only what it reviews.",
    lift: { kind: "switch" },
  }),
  humanPresence: core({
    id: "human-presence",
    protects: "A gate hears the person's own words.",
    lift: { kind: "override-once" },
  }),
  blockingCheck: core({
    id: "blocking-check",
    protects: "A blocking check passes before its gate.",
    lift: { kind: "override-once" },
  }),
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
