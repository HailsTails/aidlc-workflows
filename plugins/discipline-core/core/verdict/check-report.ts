import type {
  ExceptionRecord,
  InvalidRecord,
} from "../exception-records/exception-records.ts";
import type {
  AttributedNativeException,
  DoublyHeld,
  ExemptedFinding,
  Finding,
} from "../governance/governance.ts";
import type { ClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";

export type Unmeasured =
  | { readonly kind: "forfeiture-unmeasured" }
  | {
      readonly kind: "mechanism-not-run";
      readonly mechanism: MechanismId;
      readonly projection: "missing" | "not-included";
    };

export type ProjectionProblem = {
  readonly mechanism: MechanismId;
  readonly state: "out-of-date";
};

export type CheckReport = {
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly uncovered: readonly ClauseAddress[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly unrecorded: readonly AttributedNativeException[];
  readonly doublyHeld: readonly DoublyHeld[];
  readonly invalidRecords: readonly InvalidRecord[];
  readonly unmeasured: readonly Unmeasured[];
  readonly projectionProblems: readonly ProjectionProblem[];
};
