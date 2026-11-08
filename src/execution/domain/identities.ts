import type { Brand } from "../../kernel/brand.ts";

export type IntentId = Brand<string, "IntentId">;

export type IntentSlug = Brand<string, "IntentSlug">;

export type SpaceName = Brand<string, "SpaceName">;

export type SessionId = Brand<string, "SessionId">;

export type UnitName = Brand<string, "UnitName">;

export type CheckoutId = Brand<string, "CheckoutId">;

export type AuditEventName = Brand<string, "AuditEventName">;

export type PlanFingerprint = Brand<string, "PlanFingerprint">;

export type RecordVersion = Brand<number, "RecordVersion">;
