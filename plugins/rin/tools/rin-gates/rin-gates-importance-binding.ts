import { z } from "zod";

type MilestoneBinding =
  | { readonly kind: "milestone"; readonly identifier: string }
  | { readonly kind: "no-milestone" };

type OperatorFlag = "operator-flagged" | "lane-flagged" | "not-flagged";
type LaneFlag = "lane-flagged" | "not-flagged";

type TierValue = "T0" | "T1" | "T2" | "T3";

type MetaTier =
  | { readonly kind: "scored"; readonly value: TierValue }
  | { readonly kind: "unscored" };

type ImportanceBinding = {
  readonly flagged: OperatorFlag;
  readonly milestone: MilestoneBinding;
  readonly boundAt: string;
  readonly boundBy: string;
};

// IF-2 Option B: the written artefact carries `tier` as its own key alongside
// the ratified four. The read type stays the ratified shape so the total parser
// and its pinned totality test are untouched; the tier reaches readers through
// the second independent parse (IF-3) and the projection (IF-10).
type WritableImportanceBinding = ImportanceBinding & {
  readonly tier: MetaTier;
};

type ResolvedImportanceBinding = ImportanceBinding | "unbound";

type BindingCoverage = "bound" | "unbound";

const IMPORTANCE_BINDING_FILENAME = "importance-binding.json";

const operatorFlagSchema = z.enum([
  "operator-flagged",
  "lane-flagged",
  "not-flagged",
]);

const milestoneBindingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("milestone"), identifier: z.string() }),
  z.object({ kind: z.literal("no-milestone") }),
]);

const importanceBindingSchema = z.object({
  flagged: operatorFlagSchema,
  milestone: milestoneBindingSchema,
  boundAt: z.string(),
  boundBy: z.string(),
});

const metaTierSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("scored"),
    value: z.enum(["T0", "T1", "T2", "T3"]),
  }),
  z.object({ kind: z.literal("unscored") }),
]);

const tierCarrierSchema = z.object({ tier: z.unknown().optional() });

const tierCarrierAccepts = (args: { readonly parsed: unknown }): boolean =>
  tierCarrierSchema.safeParse(args.parsed).success;

const readTierKey = (args: { readonly parsed: unknown }): unknown => {
  const carrier = tierCarrierSchema.safeParse(args.parsed);
  return carrier.success ? carrier.data.tier : undefined;
};

const parseMetaTier = (args: { readonly parsed: unknown }): MetaTier => {
  const validated = metaTierSchema.safeParse(
    readTierKey({ parsed: args.parsed }),
  );
  return validated.success ? validated.data : { kind: "unscored" };
};

type TierParseAnomaly =
  | { readonly kind: "none" }
  | { readonly kind: "unrecognised-tier"; readonly received: string };

type MetaTierReading = {
  readonly tier: MetaTier;
  readonly anomaly: TierParseAnomaly;
};

const readMetaTierWithAnomaly = (args: {
  readonly parsed: unknown;
}): MetaTierReading => {
  const key = readTierKey({ parsed: args.parsed });
  const validated = metaTierSchema.safeParse(key);
  if (validated.success) {
    return { tier: validated.data, anomaly: { kind: "none" } };
  }
  if (key === undefined) {
    return { tier: { kind: "unscored" }, anomaly: { kind: "none" } };
  }
  return {
    tier: { kind: "unscored" },
    anomaly: { kind: "unrecognised-tier", received: JSON.stringify(key) ?? "" },
  };
};

const parseImportanceBinding = (args: {
  readonly raw: string | null;
}): ResolvedImportanceBinding => {
  if (args.raw === null) return "unbound";
  const parsed = ((): unknown => {
    try {
      return JSON.parse(args.raw);
    } catch {
      return undefined;
    }
  })();
  if (parsed === undefined) return "unbound";
  const validated = importanceBindingSchema.safeParse(parsed);
  return validated.success ? validated.data : "unbound";
};

const coverageOf = (args: {
  readonly binding: ResolvedImportanceBinding;
}): BindingCoverage => (args.binding === "unbound" ? "unbound" : "bound");

const renderImportanceBinding = (args: {
  readonly binding: WritableImportanceBinding;
}): string => `${JSON.stringify(args.binding, null, 2)}\n`;

// The FR-4 invariant, checked wherever a Result channel exists (IF-6, IF-8) and
// never at the total read boundary (IF-3): a record whose milestone resolves as
// ratified may not also carry a scored tier. `ratified` is config-resolved at
// rank time and out of the parser's reach, so the caller supplies the verdict.
const violatesMilestoneTierExclusion = (args: {
  readonly milestoneIsRatified: boolean;
  readonly tier: MetaTier;
}): boolean => args.milestoneIsRatified && args.tier.kind === "scored";

export {
  type BindingCoverage,
  coverageOf,
  IMPORTANCE_BINDING_FILENAME,
  type ImportanceBinding,
  type LaneFlag,
  type MetaTier,
  type MetaTierReading,
  type MilestoneBinding,
  type OperatorFlag,
  parseImportanceBinding,
  parseMetaTier,
  type ResolvedImportanceBinding,
  readMetaTierWithAnomaly,
  readTierKey,
  renderImportanceBinding,
  type TierParseAnomaly,
  type TierValue,
  tierCarrierAccepts,
  violatesMilestoneTierExclusion,
  type WritableImportanceBinding,
};
