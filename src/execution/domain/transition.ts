import type { Timestamp } from "../../kernel/values.ts";
import type { StageSlug } from "../../workflow-definition/domain/identities.ts";
import type { GateDecision } from "./gate.ts";
import type { UnitName } from "./identities.ts";
import type { StageProgress } from "./workflow-record.ts";

export type TransitionCause =
  | { readonly kind: "engine-step" }
  | { readonly kind: "person-decision"; readonly decision: GateDecision };

export type Transition =
  | {
      readonly kind: "stage";
      readonly stage: StageSlug;
      readonly unit: UnitName | null;
      readonly from: StageProgress;
      readonly to: StageProgress;
      readonly cause: TransitionCause;
      readonly at: Timestamp;
    }
  | { readonly kind: "park"; readonly at: Timestamp }
  | { readonly kind: "resume"; readonly at: Timestamp }
  | {
      readonly kind: "reopen";
      readonly personSinceFinished: "spoke" | "silent";
      readonly at: Timestamp;
    }
  | { readonly kind: "complete"; readonly at: Timestamp };
