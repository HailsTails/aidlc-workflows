import type { Brand } from "../../kernel/brand.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";

export type IntentId = Brand<string, "IntentId">;

export type IntentSlug = Brand<string, "IntentSlug">;

export type SpaceName = Brand<string, "SpaceName">;

export type SessionId = Brand<string, "SessionId">;

export type UnitName = Brand<string, "UnitName">;

export type CheckoutId = Brand<string, "CheckoutId">;

export type PlanFingerprint = Brand<string, "PlanFingerprint">;

export type RecordVersion = Brand<number, "RecordVersion">;

export type AuditSequence = Brand<number, "AuditSequence">;

export type ExecutionIdentity =
  | "intent"
  | "intent-slug"
  | "space"
  | "session"
  | "unit"
  | "checkout"
  | "plan-fingerprint"
  | "record-version"
  | "audit-sequence";

export type ExecutionIdentityRefusal = {
  readonly kind: "invalid-execution-identity";
  readonly identity: ExecutionIdentity;
  readonly raw: string;
};

const KEBAB = /^[a-z][a-z0-9-]*$/;
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FINGERPRINT = /^sha256:[0-9a-f]{64}$/;

const textual =
  <Identity extends string>({
    identity,
    pattern,
  }: {
    readonly identity: ExecutionIdentity;
    readonly pattern: RegExp;
  }) =>
  (raw: string): Result<Identity, ExecutionIdentityRefusal> =>
    pattern.test(raw)
      ? accepted(raw as Identity)
      : refused({ kind: "invalid-execution-identity", identity, raw });

const counted =
  <Identity extends number>(identity: ExecutionIdentity) =>
  (raw: number): Result<Identity, ExecutionIdentityRefusal> =>
    Number.isSafeInteger(raw) && raw >= 0
      ? accepted(raw as Identity)
      : refused({ kind: "invalid-execution-identity", identity, raw: String(raw) });

export const intentId = textual<IntentId>({ identity: "intent", pattern: OPAQUE });

export const intentSlug = textual<IntentSlug>({ identity: "intent-slug", pattern: KEBAB });

export const spaceName = textual<SpaceName>({ identity: "space", pattern: KEBAB });

export const sessionId = textual<SessionId>({ identity: "session", pattern: OPAQUE });

export const unitName = textual<UnitName>({ identity: "unit", pattern: OPAQUE });

export const checkoutId = textual<CheckoutId>({ identity: "checkout", pattern: OPAQUE });

export const planFingerprint = textual<PlanFingerprint>({
  identity: "plan-fingerprint",
  pattern: FINGERPRINT,
});

export const recordVersion = counted<RecordVersion>("record-version");

export const auditSequence = counted<AuditSequence>("audit-sequence");
