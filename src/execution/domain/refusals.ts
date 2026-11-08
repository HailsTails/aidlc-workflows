import type { GuardRefusal } from "./guard.ts";
import type { IntentId, RecordVersion } from "./identities.ts";

export type ExecutionRefusal =
  | { readonly kind: "guard"; readonly refusal: GuardRefusal }
  | { readonly kind: "record-not-found"; readonly intent: IntentId }
  | {
      readonly kind: "record-unreadable";
      readonly intent: IntentId;
      readonly issues: readonly string[];
    }
  | {
      readonly kind: "record-changed";
      readonly intent: IntentId;
      readonly expected: RecordVersion;
      readonly found: RecordVersion;
    }
  | { readonly kind: "method-unavailable"; readonly reason: string };
