import { z } from "zod";
import type { TierValue } from "./rin-gates-importance-binding.ts";

type TierClaim =
  | {
      readonly kind: "priced-incident";
      readonly currency: string | null;
      readonly amount: string | null;
      readonly evidence: string | null;
    }
  | {
      readonly kind: "measured-recurrence";
      readonly perOccurrenceCost: string | null;
      readonly occurrences: string | null;
      readonly denominator: string | null;
      readonly evidence: string | null;
    };

const nullableClaimComponent = z.string().nullable();

const tierClaimSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("priced-incident"),
    currency: nullableClaimComponent,
    amount: nullableClaimComponent,
    evidence: nullableClaimComponent,
  }),
  z.object({
    kind: z.literal("measured-recurrence"),
    perOccurrenceCost: nullableClaimComponent,
    occurrences: nullableClaimComponent,
    denominator: nullableClaimComponent,
    evidence: nullableClaimComponent,
  }),
]);

type TierClaimParseFailure = { readonly kind: "malformed-tier-claim" };

type TierClaimParseResult =
  | { readonly outcome: "ok"; readonly value: TierClaim }
  | { readonly outcome: "failed"; readonly error: TierClaimParseFailure };

const parseTierClaim = (args: {
  readonly raw: string;
}): TierClaimParseResult => {
  const parsed = ((): unknown => {
    try {
      return JSON.parse(args.raw);
    } catch {
      return undefined;
    }
  })();
  const validated = tierClaimSchema.safeParse(parsed);
  return validated.success
    ? { outcome: "ok", value: validated.data }
    : { outcome: "failed", error: { kind: "malformed-tier-claim" } };
};

type PricedIncidentComponent = "currency" | "amount" | "evidence";
type MeasuredRecurrenceComponent =
  | "perOccurrenceCost"
  | "occurrences"
  | "denominator"
  | "evidence";

type CheckedProperty = "completeness" | "completeness-and-citation-resolved";

type TierAssessment =
  | {
      readonly kind: "priced-incident";
      readonly assessed: TierValue;
      readonly missing: readonly PricedIncidentComponent[];
      readonly checkedProperty: CheckedProperty;
    }
  | {
      readonly kind: "measured-recurrence";
      readonly assessed: TierValue;
      readonly missing: readonly MeasuredRecurrenceComponent[];
      readonly checkedProperty: CheckedProperty;
    };

const TIER_FLOOR = "T3" satisfies TierValue;

const isNamed = (args: { readonly component: string | null }): boolean =>
  args.component !== null && args.component !== "";

const assessedTierFor = (args: {
  readonly claimed: TierValue;
  readonly missingCount: number;
}): TierValue => (args.missingCount === 0 ? args.claimed : TIER_FLOOR);

const missingPricedIncidentComponents = (args: {
  readonly claim: Extract<TierClaim, { kind: "priced-incident" }>;
}): readonly PricedIncidentComponent[] =>
  (
    [
      ["currency", args.claim.currency],
      ["amount", args.claim.amount],
      ["evidence", args.claim.evidence],
    ] as const satisfies readonly (readonly [
      PricedIncidentComponent,
      string | null,
    ])[]
  )
    .filter(([, value]) => !isNamed({ component: value }))
    .map(([component]) => component);

const missingMeasuredRecurrenceComponents = (args: {
  readonly claim: Extract<TierClaim, { kind: "measured-recurrence" }>;
}): readonly MeasuredRecurrenceComponent[] =>
  (
    [
      ["perOccurrenceCost", args.claim.perOccurrenceCost],
      ["occurrences", args.claim.occurrences],
      ["denominator", args.claim.denominator],
      ["evidence", args.claim.evidence],
    ] as const satisfies readonly (readonly [
      MeasuredRecurrenceComponent,
      string | null,
    ])[]
  )
    .filter(([, value]) => !isNamed({ component: value }))
    .map(([component]) => component);

const assessTierClaim = (args: {
  readonly claimed: TierValue;
  readonly claim: TierClaim;
}): TierAssessment => {
  switch (args.claim.kind) {
    case "priced-incident": {
      const missing = missingPricedIncidentComponents({ claim: args.claim });
      return {
        kind: "priced-incident",
        assessed: assessedTierFor({
          claimed: args.claimed,
          missingCount: missing.length,
        }),
        missing,
        checkedProperty: "completeness",
      };
    }
    case "measured-recurrence": {
      const missing = missingMeasuredRecurrenceComponents({
        claim: args.claim,
      });
      return {
        kind: "measured-recurrence",
        assessed: assessedTierFor({
          claimed: args.claimed,
          missingCount: missing.length,
        }),
        missing,
        checkedProperty: "completeness",
      };
    }
  }
};

export {
  assessTierClaim,
  type CheckedProperty,
  type MeasuredRecurrenceComponent,
  type PricedIncidentComponent,
  parseTierClaim,
  type TierAssessment,
  type TierClaim,
  type TierClaimParseFailure,
  type TierClaimParseResult,
};
