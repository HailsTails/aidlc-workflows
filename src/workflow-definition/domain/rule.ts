import type { RelativePath } from "../../kernel/values.ts";
import type { Owner, SensorId } from "./identities.ts";
import type { Phase } from "./vocabulary.ts";

export type RuleLayer =
  | { readonly kind: "org" }
  | { readonly kind: "team" }
  | { readonly kind: "project" }
  | { readonly kind: "phase"; readonly phase: Phase };

export type RulePairing =
  | { readonly kind: "unpaired" }
  | { readonly kind: "feedforward-only" }
  | { readonly kind: "sensor"; readonly sensor: SensorId };

export type Rule = {
  readonly source: RelativePath;
  readonly layer: RuleLayer;
  readonly owner: Owner;
  readonly pairing: RulePairing;
  readonly status: string | null;
  readonly staleAfter: string | null;
  readonly text: string;
};
