import type { Timestamp } from "../../kernel/values.ts";
import type { IntentId, SessionId, SpaceName } from "./identities.ts";

export const SESSION_BINDING_SOURCES = [
  "create",
  "observed-create",
  "migration",
  "switch",
  "archive",
  "space-switch-cursor",
  "space-switch-lone",
  "space-switch-none",
  "worktree",
  "unit-claim",
  "cursor",
  "cursor-followed",
  "stamp",
  "unjoined",
  "none",
] as const;

export type SessionBindingSource = (typeof SESSION_BINDING_SOURCES)[number];

export type SessionBinding = {
  readonly space: SpaceName;
  readonly intent: IntentId | null;
  readonly boundAt: Timestamp;
  readonly source: SessionBindingSource;
};

export type Session = {
  readonly id: SessionId;
  readonly binding: SessionBinding | null;
  readonly startedAt: Timestamp;
};
