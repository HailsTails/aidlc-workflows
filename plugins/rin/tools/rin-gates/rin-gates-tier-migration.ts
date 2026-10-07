import {
  parseImportanceBinding,
  type TierValue,
  violatesMilestoneTierExclusion,
} from "./rin-gates-importance-binding.ts";
import type {
  Clock,
  RecordStore,
  RecordStoreFailure,
} from "./rin-gates-record-store.ts";
import { assessTierClaim, type TierClaim } from "./rin-gates-tier-claim.ts";

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const TIER_SECTION_HEADING = "## 5. Meta tier";
const TIER_VALUES: readonly TierValue[] = ["T0", "T1", "T2", "T3"];

type HeadlineExtraction =
  | { readonly kind: "declared"; readonly value: TierValue }
  | { readonly kind: "no-tier-section" }
  | { readonly kind: "unrecognised-idiom"; readonly headline: string }
  | {
      readonly kind: "multi-tier-ambiguous";
      readonly candidate: TierValue;
      readonly dissenting: TierValue;
      readonly headline: string;
    };

const isTierValue = (candidate: string): candidate is TierValue =>
  TIER_VALUES.some((value) => value === candidate);

const sectionBodyAfter = (args: {
  readonly derivation: string;
  readonly heading: string;
}): string | null => {
  const lines = args.derivation.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === args.heading);
  return headingIndex === -1 ? null : lines.slice(headingIndex + 1).join("\n");
};

const firstNonBlankLine = (args: { readonly body: string }): string | null => {
  const line = args.body.split("\n").find((entry) => entry.trim() !== "");
  return line ?? null;
};

// The candidate tier is the LEADING token of the headline, in any of the three
// idioms the corpus uses: `**T1 — ...`, `T3. ...`, and `**Tier: T3 — ...`.
// Position, never a scan: 64 headlines name more than one tier because rejected
// tiers appear as boundary argument ("it is not T0 because ..."), so searching
// for any tier token would read the argument rather than the verdict.
//
// But a leading token is not always the verdict. Some headlines open with a
// CANDIDATE and retract it later — "T1 ... candidate but not clearly cited ...
// the discipline requires T3", "this defaults T3 — not T2 as initially
// considered", "this is currently T3". Reading position alone over-ranks those
// records SILENTLY, in `declared` rather than residue, which is the failure
// direction FR-3 exists to prevent.
//
// The rule is STRUCTURAL and deliberately CONSERVATIVE, not a vocabulary list.
// An earlier fix matched a hand-maintained set of retraction phrasings and had
// to be widened twice as each review round found phrasings it had not
// anticipated (3 -> 10 -> 12 records). A phrase allowlist over free prose is
// unfalsifiable against a corpus nobody has read end to end, and each widening
// only ever covered the examples that round happened to surface.
//
// So the rule is: a headline naming ANY tier other than its leading one is
// AMBIGUOUS, and ambiguity is surfaced rather than resolved (FR-3: surfaced,
// never guessed). Telling "argues against T0" apart from "withdraws to T3" is
// natural-language judgement that a regex cannot do reliably in both
// directions — and the two error directions are NOT symmetric. Over-surfacing
// sends a record to a human who confirms its tier; under-surfacing silently
// binds a tier the derivation itself withdrew, which is the failure FR-3
// exists to prevent and which no report would flag. When the mechanism cannot
// be made reliable, it must fail toward the recoverable error.
//
// Consequence, stated rather than hidden: the residue is LARGER than the set
// of genuine retractions, because every boundary-argument headline lands there
// too. That is the intended trade, not a defect to tune away — and it is why
// the migration reports residue by reason rather than a single count.
const TIER_TOKEN = /\bT[0-3]\b/g;

const dissentingTierOf = (args: {
  readonly headline: string;
  readonly leading: TierValue;
}): TierValue | null => {
  const dissent = [...args.headline.matchAll(TIER_TOKEN)]
    .map((match) => match[0])
    .find((token) => isTierValue(token) && token !== args.leading);
  return dissent !== undefined && isTierValue(dissent) ? dissent : null;
};

const extractTierFromHeadline = (args: {
  readonly derivation: string;
}): HeadlineExtraction => {
  const section = sectionBodyAfter({
    derivation: args.derivation,
    heading: TIER_SECTION_HEADING,
  });
  const headline =
    section === null ? null : firstNonBlankLine({ body: section });
  if (headline === null) return { kind: "no-tier-section" };
  const trimmed = headline.trim();
  const leading = /^\**\s*(?:Tier:\s*)?(T[0-3])\b/.exec(trimmed);
  const captured = leading?.[1];
  if (captured === undefined || !isTierValue(captured))
    return { kind: "unrecognised-idiom", headline: trimmed };

  const dissent = dissentingTierOf({ headline: trimmed, leading: captured });
  return dissent !== null
    ? {
        kind: "multi-tier-ambiguous",
        candidate: captured,
        dissenting: dissent,
        headline: trimmed,
      }
    : { kind: "declared", value: captured };
};

type ClaimLabel = "currency" | "amount" | "evidence";
const CLAIM_LABELS: readonly ClaimLabel[] = ["currency", "amount", "evidence"];

const CLAIM_LABEL_ONSET = `(?:^|(?<=[.!?"'*)\\]])\\s|(?<=\\n))\\s*`;

const claimLabelPattern = (label: ClaimLabel): RegExp =>
  new RegExp(`${CLAIM_LABEL_ONSET}\\*{0,2}${label}\\s*:\\s*\\*{0,2}\\s*`, "im");

const NEXT_CLAIM_LABEL = new RegExp(
  `${CLAIM_LABEL_ONSET}\\*{0,2}(?:currency|amount|evidence)\\s*:\\s*\\*{0,2}`,
  "im",
);

const EXPLICITLY_UNNAMED_COMPONENT_OPENING = /^(?:none\b|n\/a\b|no\b)/i;

const claimComponentValueOf = (args: {
  readonly section: string;
  readonly label: ClaimLabel;
}): string | null => {
  const labelMatch = claimLabelPattern(args.label).exec(args.section);
  if (labelMatch === null) return null;
  const afterLabel = args.section.slice(
    labelMatch.index + labelMatch[0].length,
  );
  const nextLabelMatch = NEXT_CLAIM_LABEL.exec(afterLabel);
  const rawValue = (
    nextLabelMatch === null
      ? afterLabel
      : afterLabel.slice(0, nextLabelMatch.index)
  ).trim();
  return rawValue === "" || EXPLICITLY_UNNAMED_COMPONENT_OPENING.test(rawValue)
    ? null
    : rawValue;
};

const extractPricedIncidentClaimFromDerivation = (args: {
  readonly derivation: string;
}): TierClaim | null => {
  const section = sectionBodyAfter({
    derivation: args.derivation,
    heading: TIER_SECTION_HEADING,
  });
  if (section === null) return null;
  const hasAnyLabel = CLAIM_LABELS.some(
    (label) => claimLabelPattern(label).exec(section) !== null,
  );
  if (!hasAnyLabel) return null;
  return {
    kind: "priced-incident",
    currency: claimComponentValueOf({ section, label: "currency" }),
    amount: claimComponentValueOf({ section, label: "amount" }),
    evidence: claimComponentValueOf({ section, label: "evidence" }),
  };
};

type MigrationRecord = {
  readonly recordDir: string;
  readonly derivation: string | null;
  readonly claim: TierClaim | null;
  readonly milestoneIsRatified: boolean;
};

type RecordMigration =
  | {
      readonly kind: "migrated";
      readonly recordDir: string;
      readonly claimed: TierValue;
      readonly assessed: TierValue;
    }
  | {
      readonly kind: "residue";
      readonly recordDir: string;
      readonly reason:
        | "no-derivation"
        | "no-tier-section"
        | "unrecognised-idiom"
        | "multi-tier-ambiguous";
    }
  | {
      readonly kind: "refused";
      readonly recordDir: string;
      readonly milestone: string;
      readonly tier: TierValue;
    };

const migrateRecord = (args: {
  readonly record: MigrationRecord;
}): RecordMigration => {
  const { recordDir, derivation, claim, milestoneIsRatified } = args.record;
  if (derivation === null)
    return { kind: "residue", recordDir, reason: "no-derivation" };

  const extracted = extractTierFromHeadline({ derivation });
  if (extracted.kind === "no-tier-section")
    return { kind: "residue", recordDir, reason: "no-tier-section" };
  if (extracted.kind === "unrecognised-idiom")
    return { kind: "residue", recordDir, reason: "unrecognised-idiom" };
  if (extracted.kind === "multi-tier-ambiguous")
    return { kind: "residue", recordDir, reason: "multi-tier-ambiguous" };

  const assessed =
    claim === null
      ? extracted.value
      : assessTierClaim({ claimed: extracted.value, claim }).assessed;

  return violatesMilestoneTierExclusion({
    milestoneIsRatified,
    tier: { kind: "scored", value: assessed },
  })
    ? {
        kind: "refused",
        recordDir,
        milestone: "ratified",
        tier: assessed,
      }
    : { kind: "migrated", recordDir, claimed: extracted.value, assessed };
};

type TierDistribution = Readonly<Record<TierValue, number>>;

const occurrencesOf = (args: {
  readonly tiers: readonly TierValue[];
  readonly tier: TierValue;
}): number => args.tiers.filter((candidate) => candidate === args.tier).length;

const distributionOf = (args: {
  readonly tiers: readonly TierValue[];
}): TierDistribution => ({
  T0: occurrencesOf({ tiers: args.tiers, tier: "T0" }),
  T1: occurrencesOf({ tiers: args.tiers, tier: "T1" }),
  T2: occurrencesOf({ tiers: args.tiers, tier: "T2" }),
  T3: occurrencesOf({ tiers: args.tiers, tier: "T3" }),
});

type MigrationReport = {
  readonly before: TierDistribution;
  readonly after: TierDistribution;
  readonly demoted: number;
  readonly migrated: number;
  readonly residue: readonly RecordMigration[];
  readonly refused: readonly RecordMigration[];
  readonly derivation: readonly string[];
  readonly ranAt: string;
};

// Shipped with the report so the next reader re-runs the derivation rather than
// inheriting its numbers (counts drift with the corpus; the METHOD is the claim).
const MIGRATION_DERIVATION: readonly string[] = [
  'grep -lE "^## 5\\. Meta tier" aidlc/spaces/default/intents/*/importance-derivation.md | wc -l',
  'grep -lE "^\\*\\*Tier:\\s*T[0-3]" aidlc/spaces/default/intents/*/importance-derivation.md | wc -l',
  "pnpm vitest run --config plugins/rin/vitest.config.ts rin-gates-tier-migration",
];

const renderMigrationReport = (args: {
  readonly migrations: readonly RecordMigration[];
  readonly ranAt: Date;
}): MigrationReport => {
  const migrated = args.migrations.filter(
    (migration): migration is Extract<RecordMigration, { kind: "migrated" }> =>
      migration.kind === "migrated",
  );
  return {
    before: distributionOf({ tiers: migrated.map((entry) => entry.claimed) }),
    after: distributionOf({ tiers: migrated.map((entry) => entry.assessed) }),
    demoted: migrated.filter((entry) => entry.assessed !== entry.claimed)
      .length,
    migrated: migrated.length,
    residue: args.migrations.filter(
      (migration) => migration.kind === "residue",
    ),
    refused: args.migrations.filter(
      (migration) => migration.kind === "refused",
    ),
    derivation: MIGRATION_DERIVATION,
    ranAt: args.ranAt.toISOString(),
  };
};

const runTierMigration = (args: {
  readonly records: readonly MigrationRecord[];
  readonly clock: Clock;
}): MigrationReport =>
  renderMigrationReport({
    migrations: args.records.map((record) => migrateRecord({ record })),
    ranAt: args.clock.nowUtc(),
  });

type MigrationGatherFailure =
  | RecordStoreFailure
  | { readonly kind: "malformed-binding"; readonly recordDir: string };

// A binding that is PRESENT but fails IF-1's total parse is a distinct outcome
// from an ABSENT binding: absence is a real, meaningful "unbound record" state
// (resolves not-ratified), while a present-but-unparseable artefact is data
// corruption FR-4 cannot safely read past. `parseImportanceBinding` is IF-1's
// locked total parser and deliberately collapses both to "unbound" for its own
// callers — this reads the raw string itself first so the two stay separable
// here without touching that parser or re-deriving its schema.
const ratifiedMilestoneReadingOf = (args: {
  readonly recordDir: string;
  readonly raw: string | null;
  readonly ratifiedMilestones: readonly string[];
}): Result<boolean, MigrationGatherFailure> => {
  if (args.raw === null) return { outcome: "ok", value: false };
  const parsed = parseImportanceBinding({ raw: args.raw });
  if (parsed === "unbound")
    return {
      outcome: "failed",
      error: { kind: "malformed-binding", recordDir: args.recordDir },
    };
  return {
    outcome: "ok",
    value:
      parsed.milestone.kind === "milestone" &&
      args.ratifiedMilestones.includes(parsed.milestone.identifier),
  };
};

type RecordReads = {
  readonly recordDir: string;
  readonly derivation: Result<string | null, RecordStoreFailure>;
  readonly binding: Result<string | null, RecordStoreFailure>;
};

const firstReadFailure = (args: {
  readonly reads: readonly RecordReads[];
}): RecordStoreFailure | null => {
  const failedDerivation = args.reads.find(
    (entry) => entry.derivation.outcome === "failed",
  );
  if (
    failedDerivation !== undefined &&
    failedDerivation.derivation.outcome === "failed"
  )
    return failedDerivation.derivation.error;

  const failedBinding = args.reads.find(
    (entry) => entry.binding.outcome === "failed",
  );
  return failedBinding !== undefined &&
    failedBinding.binding.outcome === "failed"
    ? failedBinding.binding.error
    : null;
};

type RatificationReading = {
  readonly recordDir: string;
  readonly reading: Result<boolean, MigrationGatherFailure>;
};

const ratificationsOf = (args: {
  readonly reads: readonly RecordReads[];
  readonly ratifiedMilestones: readonly string[];
}): readonly RatificationReading[] =>
  args.reads.map((entry) => ({
    recordDir: entry.recordDir,
    reading: ratifiedMilestoneReadingOf({
      recordDir: entry.recordDir,
      raw: entry.binding.outcome === "ok" ? entry.binding.value : null,
      ratifiedMilestones: args.ratifiedMilestones,
    }),
  }));

const firstMalformedBinding = (args: {
  readonly ratifications: readonly RatificationReading[];
}): MigrationGatherFailure | null => {
  const malformed = args.ratifications.find(
    (entry) => entry.reading.outcome === "failed",
  );
  return malformed !== undefined && malformed.reading.outcome === "failed"
    ? malformed.reading.error
    : null;
};

const migrationRecordsOf = (args: {
  readonly reads: readonly RecordReads[];
  readonly ratifications: readonly RatificationReading[];
}): readonly MigrationRecord[] =>
  args.reads.flatMap((entry, index) => {
    const ratification = args.ratifications[index];
    if (
      entry.derivation.outcome !== "ok" ||
      ratification === undefined ||
      ratification.reading.outcome !== "ok"
    )
      return [];
    const derivation = entry.derivation.value;
    return [
      {
        recordDir: entry.recordDir,
        derivation,
        claim:
          derivation === null
            ? null
            : extractPricedIncidentClaimFromDerivation({ derivation }),
        milestoneIsRatified: ratification.reading.value,
      } satisfies MigrationRecord,
    ];
  });

// Reads the corpus through the injected stores, so the traversal that feeds
// the migration is the same seam the tests fake — no ambient node:fs on this
// path. `derivations` and `bindings` are each a RecordStore constructed over
// their own filename; the locked three-member interface is used as-is on both
// rather than widened to carry two files through one instance.
const gatherMigrationRecords = (args: {
  readonly intentsRoot: string;
  readonly derivations: RecordStore;
  readonly bindings: RecordStore;
  readonly ratifiedMilestones: readonly string[];
}): Result<readonly MigrationRecord[], MigrationGatherFailure> => {
  const dirs = args.derivations.listRecordDirs({
    intentsRoot: args.intentsRoot,
  });
  if (dirs.outcome === "failed") return dirs;

  const reads = dirs.value.map((recordDir) => ({
    recordDir,
    derivation: args.derivations.readBinding({ recordDir }),
    binding: args.bindings.readBinding({ recordDir }),
  }));

  const readFailure = firstReadFailure({ reads });
  if (readFailure !== null) return { outcome: "failed", error: readFailure };

  const ratifications = ratificationsOf({
    reads,
    ratifiedMilestones: args.ratifiedMilestones,
  });

  const malformedBinding = firstMalformedBinding({ ratifications });
  if (malformedBinding !== null)
    return { outcome: "failed", error: malformedBinding };

  return {
    outcome: "ok",
    value: migrationRecordsOf({ reads, ratifications }),
  };
};

type ResidueReason = Extract<RecordMigration, { kind: "residue" }>["reason"];

const residueCountOf = (args: {
  readonly report: MigrationReport;
  readonly reason: ResidueReason;
}): number =>
  args.report.residue.filter(
    (entry) => entry.kind === "residue" && entry.reason === args.reason,
  ).length;

const renderMigrationSummary = (args: {
  readonly report: MigrationReport;
}): string =>
  [
    `rin-gates-tier-migration: ran at ${args.report.ranAt}`,
    `migrated ${args.report.migrated} (demoted ${args.report.demoted})`,
    `before  T0 ${args.report.before.T0} · T1 ${args.report.before.T1} · T2 ${args.report.before.T2} · T3 ${args.report.before.T3}`,
    `after   T0 ${args.report.after.T0} · T1 ${args.report.after.T1} · T2 ${args.report.after.T2} · T3 ${args.report.after.T3}`,
    `residue ${args.report.residue.length} · refused ${args.report.refused.length}`,
    `  no-derivation ${residueCountOf({ report: args.report, reason: "no-derivation" })} · no-tier-section ${residueCountOf({ report: args.report, reason: "no-tier-section" })} · unrecognised-idiom ${residueCountOf({ report: args.report, reason: "unrecognised-idiom" })} · multi-tier-ambiguous ${residueCountOf({ report: args.report, reason: "multi-tier-ambiguous" })}`,
    "derivation:",
    ...args.report.derivation.map((command) => `  ${command}`),
  ].join("\n");

export {
  distributionOf,
  extractPricedIncidentClaimFromDerivation,
  extractTierFromHeadline,
  gatherMigrationRecords,
  type HeadlineExtraction,
  type MigrationGatherFailure,
  type MigrationRecord,
  type MigrationReport,
  migrateRecord,
  type RecordMigration,
  renderMigrationReport,
  renderMigrationSummary,
  runTierMigration,
  type TierDistribution,
};
