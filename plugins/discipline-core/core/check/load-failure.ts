import type { RunnerFailure } from "../mechanism-port/runner-failure.ts";
import type { MechanismId } from "../values/identifiers.ts";

export type LoadFailure =
  | { readonly kind: "arguments-invalid"; readonly detail: string }
  | { readonly kind: "install-root-unresolvable"; readonly url: string; readonly detail: string }
  | { readonly kind: "file-unreadable"; readonly path: string; readonly detail: string }
  | { readonly kind: "file-malformed"; readonly path: string; readonly detail: string }
  | { readonly kind: "unsupported-version"; readonly path: string; readonly found: unknown }
  | { readonly kind: "reserved-rule-set-name"; readonly name: string }
  | { readonly kind: "unknown-rule-set"; readonly name: string }
  | { readonly kind: "unknown-discipline"; readonly address: string }
  | { readonly kind: "unknown-clause"; readonly address: string }
  | { readonly kind: "judgement-clause-selected"; readonly address: string }
  | { readonly kind: "mechanism-not-allowed"; readonly address: string; readonly mechanism: MechanismId }
  | { readonly kind: "runner-missing"; readonly mechanism: MechanismId }
  | { readonly kind: "runner-invalid"; readonly mechanism: MechanismId; readonly detail: string }
  | { readonly kind: "piece-missing"; readonly address: string; readonly mechanism: MechanismId }
  | { readonly kind: "rule-set-invalid"; readonly path: string; readonly detail: string }
  | { readonly kind: "git-failed"; readonly detail: string }
  | { readonly kind: "runner-failed"; readonly mechanism: MechanismId; readonly failure: RunnerFailure };
