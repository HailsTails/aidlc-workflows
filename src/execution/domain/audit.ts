import type { Timestamp } from "../../kernel/values.ts";
import type { AuditEventName, IntentId, SessionId } from "./identities.ts";

export type AuditEvent = {
  readonly name: AuditEventName;
  readonly intent: IntentId | null;
  readonly session: SessionId | null;
  readonly at: Timestamp;
  readonly fields: Readonly<Record<string, string>>;
};
