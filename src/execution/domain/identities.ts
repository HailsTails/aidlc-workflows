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
  <Identity extends string>(identity: ExecutionIdentity, pattern: RegExp) =>
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

export const intentId = textual<IntentId>("intent", OPAQUE);

export const intentSlug = textual<IntentSlug>("intent-slug", KEBAB);

export const spaceName = textual<SpaceName>("space", KEBAB);

export const sessionId = textual<SessionId>("session", OPAQUE);

export const unitName = textual<UnitName>("unit", OPAQUE);

export const checkoutId = textual<CheckoutId>("checkout", OPAQUE);

export const planFingerprint = textual<PlanFingerprint>("plan-fingerprint", FINGERPRINT);

export const recordVersion = counted<RecordVersion>("record-version");

export const auditSequence = counted<AuditSequence>("audit-sequence");
