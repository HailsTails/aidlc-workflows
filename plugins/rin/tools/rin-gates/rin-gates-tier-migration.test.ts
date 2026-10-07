import { describe, expect, test } from "vitest";
import type { Clock, RecordStore } from "./rin-gates-record-store.ts";
import {
  distributionOf,
  extractPricedIncidentClaimFromDerivation,
  extractTierFromHeadline,
  gatherMigrationRecords,
  type MigrationGatherFailure,
  type MigrationRecord,
  migrateRecord,
  type RecordMigration,
  renderMigrationReport,
  renderMigrationSummary,
  runTierMigration,
} from "./rin-gates-tier-migration.ts";

const storeOf = (args: {
  readonly recordDirs: readonly string[];
  readonly derivations: Readonly<Record<string, string | null>>;
}): RecordStore => ({
  readBinding: ({ recordDir }) => ({
    outcome: "ok",
    value: args.derivations[recordDir] ?? null,
  }),
  writeBinding: () => ({ outcome: "ok", value: undefined }),
  listRecordDirs: () => ({ outcome: "ok", value: args.recordDirs }),
});

const pinnedClock: Clock = { nowUtc: () => new Date("2026-09-02T08:00:00Z") };

const derivationWith = (headline: string): string =>
  [
    "# Importance derivation",
    "## 4. Neglect",
    "text",
    "## 5. Meta tier",
    headline,
    "more prose",
  ].join("\n");

const baseRecord = (overrides: Partial<MigrationRecord>): MigrationRecord => ({
  recordDir: "/intents/alpha",
  derivation: derivationWith("**T1 — failure-class removal.**"),
  claim: null,
  milestoneIsRatified: false,
  ...overrides,
});

const derivationWithTierSection = (section: string): string =>
  [
    "# Importance derivation",
    "## 4. Neglect",
    "text",
    "## 5. Meta tier",
    section,
  ].join("\n");

describe("extractTierFromHeadline", () => {
  test("reads the bold idiom used by 145 of the corpus's derivations", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith("**T1 — failure-class removal.**"),
      }),
    ).toEqual({ kind: "declared", value: "T1" });
  });

  test("reads the bare idiom used by the other 74", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith("T3. No incident is cited."),
      }),
    ).toEqual({ kind: "declared", value: "T3" });
  });

  test("reads the labelled idiom used by the 41-record 2026-08-10..14 cohort", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith("**Tier: T3 — ergonomics and hygiene.**"),
      }),
    ).toEqual({ kind: "declared", value: "T3" });
  });

  test("surfaces a headline naming any other tier, because argument and retraction are not separable by pattern", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith(
          "**T1 — it is not T0 because it is a CI gate rather than identity machinery, and not T3 since an incident is cited.**",
        ),
      }),
    ).toMatchObject({
      kind: "multi-tier-ambiguous",
      candidate: "T1",
    });
  });

  test("declares a single-tier headline, which is the only unambiguous shape", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith(
          "**T1 — failure-class removal.** A dated incident is cited with a measured cost.",
        ),
      }),
    ).toEqual({ kind: "declared", value: "T1" });
  });

  test("surfaces a headline that retracts its leading candidate, rather than reading the candidate as the verdict", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith(
          "T1 — failure-class removal, candidate but not clearly cited. The framing describes a structural absence rather than a cited occurrence of harm. Absent a named incident, the discipline requires T3: the framing asserts importance.",
        ),
      }),
    ).toEqual({
      kind: "multi-tier-ambiguous",
      candidate: "T1",
      dissenting: "T3",
      headline:
        "T1 — failure-class removal, candidate but not clearly cited. The framing describes a structural absence rather than a cited occurrence of harm. Absent a named incident, the discipline requires T3: the framing asserts importance.",
    });
  });

  test("surfaces the falls-short retraction phrasing the corpus also uses", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith(
          "T2 — metered economics, measured but not costed. Amount is not expressed in a repayable currency, so per the discipline this falls short of T2 and is T3.",
        ),
      }),
    ).toMatchObject({
      kind: "multi-tier-ambiguous",
      candidate: "T2",
      dissenting: "T3",
    });
  });

  test("surfaces the phrasings a vocabulary rule missed — defaults-to and currently-is, neither matched by any phrase list", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith(
          "**T2 — metered economics.** Absent currency, amount and evidence, this defaults T3 — ergonomics and hygiene — not T2 as initially considered.",
        ),
      }),
    ).toMatchObject({ kind: "multi-tier-ambiguous", candidate: "T2" });

    expect(
      extractTierFromHeadline({
        derivation: derivationWith(
          "T1 — failure-class removal, real risk but not yet occurred. Per the discipline this is currently T3.",
        ),
      }),
    ).toMatchObject({ kind: "multi-tier-ambiguous", candidate: "T1" });
  });

  test("reports a derivation carrying no tier section rather than guessing one", () => {
    expect(
      extractTierFromHeadline({
        derivation: "# Importance derivation\n## 4. Neglect\nprose only",
      }),
    ).toEqual({ kind: "no-tier-section" });
  });

  test("reports an unrecognised headline idiom as residue rather than defaulting to T3", () => {
    expect(
      extractTierFromHeadline({
        derivation: derivationWith("Undecided pending the operator's ruling."),
      }),
    ).toEqual({
      kind: "unrecognised-idiom",
      headline: "Undecided pending the operator's ruling.",
    });
  });

  test("skips blank lines between the heading and its headline", () => {
    expect(
      extractTierFromHeadline({
        derivation: "## 5. Meta tier\n\n\n**T2 — metered economics.**",
      }),
    ).toEqual({ kind: "declared", value: "T2" });
  });
});

describe("extractPricedIncidentClaimFromDerivation", () => {
  test("extracts a complete priced-incident claim from the corpus's labelled idiom", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          [
            "**T2.** Currency: wall-clock, per search.",
            'Amount: "11.4s versus 0.30s for `git grep` on the same query" — a real measured delta.',
            'Evidence: the record states "every filesystem-walking search pays for all of them."',
          ].join("\n"),
        ),
      }),
    ).toEqual({
      kind: "priced-incident",
      currency: "wall-clock, per search.",
      amount:
        '"11.4s versus 0.30s for `git grep` on the same query" — a real measured delta.',
      evidence:
        'the record states "every filesystem-walking search pays for all of them."',
    });
  });

  test("reads the corpus's own negation idiom as an absent component, never as a demotion it computes itself", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          "T3. No incident is cited. Cannot name currency, amount, and evidence together, so T3 by the brief's own rule.",
        ),
      }),
    ).toBeNull();
  });

  test("reads the corpus's bare-no negation as an absent component, not as a named one", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          [
            "Currency: proof-integrity of the gate pipeline. Amount: one breach with a named commit. Evidence: no incident is cited where the unpinned string actually drifted or broke behaviour.",
          ].join("\n"),
        ),
      }),
    ).toEqual({
      kind: "priced-incident",
      currency: "proof-integrity of the gate pipeline.",
      amount: "one breach with a named commit.",
      evidence: null,
    });
  });

  test("holds a not-prefixed hedge as a NAMED component, because the corpus scores those records above the floor", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          'Currency: build reproducibility. Amount: not counted in incidents but the mechanism is confirmed and precedented: "the exact failure mode the CLI pin already fixed one layer below." Evidence: cited at commit level.',
        ),
      }),
    ).toEqual({
      kind: "priced-incident",
      currency: "build reproducibility.",
      amount:
        'not counted in incidents but the mechanism is confirmed and precedented: "the exact failure mode the CLI pin already fixed one layer below."',
      evidence: "cited at commit level.",
    });
  });

  test("holds a none-prefixed value carrying a trailing clause as an ABSENT component, since the clause explains the absence rather than naming a value", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          "Currency: agent wall-clock. Amount: none quantified beyond describing the mechanism. Evidence: three reproductions with timestamps.",
        ),
      }),
    ).toEqual({
      kind: "priced-incident",
      currency: "agent wall-clock.",
      amount: null,
      evidence: "three reproductions with timestamps.",
    });
  });

  test("ignores a label word used mid-sentence as ordinary prose, never reading it as a component label", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          'T2. The framing supplies a measured cost in the turns/wall-clock currency: "Cost ~12 failed push attempts" — a counted number tied to this defect.',
        ),
      }),
    ).toBeNull();
  });

  test("extracts a claim with explicit per-component negation, holding the negated component null and the rest named", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          [
            "Currency: none named.",
            "Amount: none.",
            'Evidence: cited directly — "the mechanism is real and confirmed."',
          ].join("\n"),
        ),
      }),
    ).toEqual({
      kind: "priced-incident",
      currency: null,
      amount: null,
      evidence: 'cited directly — "the mechanism is real and confirmed."',
    });
  });

  test("returns null for a record with no labelled triple at all, honouring the distinct claimless case", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          "T0. This is a forged-proof-prevention defect in the trust substrate itself.",
        ),
      }),
    ).toBeNull();
  });

  test("returns null for a derivation with no tier section", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: "# Importance derivation\n## 4. Neglect\nprose only",
      }),
    ).toBeNull();
  });

  test("reads a bolded label the same as a bare one", () => {
    expect(
      extractPricedIncidentClaimFromDerivation({
        derivation: derivationWithTierSection(
          "**T1.** **Currency:** proof-integrity. **Amount:** one confirmed breach. **Evidence:** commit 8b038b55.",
        ),
      }),
    ).toEqual({
      kind: "priced-incident",
      currency: "proof-integrity.",
      amount: "one confirmed breach.",
      evidence: "commit 8b038b55.",
    });
  });
});

describe("migrateRecord", () => {
  test("re-establishes the tier through IF-5 and demotes an unsubstantiated claim", () => {
    expect(
      migrateRecord({
        record: baseRecord({
          claim: {
            kind: "priced-incident",
            currency: null,
            amount: null,
            evidence: null,
          },
        }),
      }),
    ).toEqual({
      kind: "migrated",
      recordDir: "/intents/alpha",
      claimed: "T1",
      assessed: "T3",
    });
  });

  test("keeps a complete measured-recurrence claim at its claimed tier", () => {
    expect(
      migrateRecord({
        record: baseRecord({
          claim: {
            kind: "measured-recurrence",
            perOccurrenceCost: "25 min",
            occurrences: "6",
            denominator: "42 runs",
            evidence: "tend-log 2026-08-19",
          },
        }),
      }),
    ).toEqual({
      kind: "migrated",
      recordDir: "/intents/alpha",
      claimed: "T1",
      assessed: "T1",
    });
  });

  test("surfaces a record with no derivation as residue rather than scoring it", () => {
    expect(migrateRecord({ record: baseRecord({ derivation: null }) })).toEqual(
      {
        kind: "residue",
        recordDir: "/intents/alpha",
        reason: "no-derivation",
      },
    );
  });

  test("surfaces a derivation with no tier section as residue", () => {
    expect(
      migrateRecord({
        record: baseRecord({ derivation: "# Importance derivation\nprose" }),
      }),
    ).toEqual({
      kind: "residue",
      recordDir: "/intents/alpha",
      reason: "no-tier-section",
    });
  });

  test("routes a retracted candidate to residue rather than migrating the over-ranked candidate", () => {
    expect(
      migrateRecord({
        record: baseRecord({
          derivation: derivationWith(
            "T1 — failure-class removal, candidate but not clearly cited. Absent a named incident, the discipline requires T3.",
          ),
        }),
      }),
    ).toEqual({
      kind: "residue",
      recordDir: "/intents/alpha",
      reason: "multi-tier-ambiguous",
    });
  });

  test("refuses a scored tier on a ratified-milestone record, naming the collision", () => {
    expect(
      migrateRecord({ record: baseRecord({ milestoneIsRatified: true }) }),
    ).toEqual({
      kind: "refused",
      recordDir: "/intents/alpha",
      milestone: "ratified",
      tier: "T1",
    });
  });
});

describe("distributionOf", () => {
  test("counts every tier member, reporting an absent tier as zero not missing", () => {
    expect(distributionOf({ tiers: ["T1", "T1", "T3"] })).toEqual({
      T0: 0,
      T1: 2,
      T2: 0,
      T3: 1,
    });
  });
});

describe("renderMigrationReport", () => {
  test("reports before/after distributions, the demotion count and its derivation", () => {
    const report = renderMigrationReport({
      migrations: [
        { kind: "migrated", recordDir: "a", claimed: "T1", assessed: "T3" },
        { kind: "migrated", recordDir: "b", claimed: "T2", assessed: "T2" },
        { kind: "residue", recordDir: "c", reason: "no-tier-section" },
      ],
      ranAt: new Date("2026-09-02T08:00:00Z"),
    });

    expect(report.before).toEqual({ T0: 0, T1: 1, T2: 1, T3: 0 });
    expect(report.after).toEqual({ T0: 0, T1: 0, T2: 1, T3: 1 });
    expect(report.demoted).toBe(1);
    expect(report.migrated).toBe(2);
    expect(report.residue).toHaveLength(1);
    expect(report.derivation.length).toBeGreaterThan(0);
  });
});

describe("runTierMigration", () => {
  test("stamps the run through the injected clock rather than an ambient timer", () => {
    const report = runTierMigration({
      records: [baseRecord({})],
      clock: pinnedClock,
    });

    expect(report.ranAt).toBe("2026-09-02T08:00:00.000Z");
  });

  test("traverses every record, separating migrated from residue", () => {
    const report = runTierMigration({
      records: [
        baseRecord({ recordDir: "/intents/alpha" }),
        baseRecord({ recordDir: "/intents/beta", derivation: null }),
      ],
      clock: pinnedClock,
    });

    expect(report.migrated).toBe(1);
    expect(report.residue).toHaveLength(1);
  });
});

const bindingsStoreOf = (args: {
  readonly recordDirs: readonly string[];
  readonly bindings: Readonly<Record<string, string | null>>;
}): RecordStore => ({
  readBinding: ({ recordDir }) => ({
    outcome: "ok",
    value: args.bindings[recordDir] ?? null,
  }),
  writeBinding: () => ({ outcome: "ok", value: undefined }),
  listRecordDirs: () => ({ outcome: "ok", value: args.recordDirs }),
});

const emptyBindings: RecordStore = {
  readBinding: () => ({ outcome: "ok", value: null }),
  writeBinding: () => ({ outcome: "ok", value: undefined }),
  listRecordDirs: () => ({ outcome: "ok", value: [] }),
};

const boundToMilestone = (identifier: string): string =>
  JSON.stringify({
    flagged: "not-flagged",
    milestone: { kind: "milestone", identifier },
    boundAt: "2026-09-01T00:00:00Z",
    boundBy: "gate-0-reconcile",
  });

const migrationsOf = (args: {
  readonly gathered:
    | { readonly outcome: "ok"; readonly value: readonly MigrationRecord[] }
    | { readonly outcome: "failed"; readonly error: MigrationGatherFailure };
}): readonly RecordMigration[] | MigrationGatherFailure =>
  args.gathered.outcome === "ok"
    ? args.gathered.value.map((record) => migrateRecord({ record }))
    : args.gathered.error;

describe("gatherMigrationRecords", () => {
  test("reads every listed record dir through the injected store", () => {
    const gathered = gatherMigrationRecords({
      intentsRoot: "/intents",
      derivations: storeOf({
        recordDirs: ["/intents/alpha", "/intents/beta"],
        derivations: {
          "/intents/alpha": derivationWith("**T1 — failure-class removal.**"),
          "/intents/beta": derivationWith("T3. No incident is cited."),
        },
      }),
      bindings: emptyBindings,
      ratifiedMilestones: [],
    });

    expect(gathered).toEqual({
      outcome: "ok",
      value: [
        {
          recordDir: "/intents/alpha",
          derivation: derivationWith("**T1 — failure-class removal.**"),
          claim: null,
          milestoneIsRatified: false,
        },
        {
          recordDir: "/intents/beta",
          derivation: derivationWith("T3. No incident is cited."),
          claim: null,
          milestoneIsRatified: false,
        },
      ],
    });
  });

  test("resolves a non-null claim from a labelled derivation through the real gather entry point, and migrateRecord demotes on it — the FR-3 re-establishment path end to end", () => {
    const gathered = gatherMigrationRecords({
      intentsRoot: "/intents",
      derivations: storeOf({
        recordDirs: ["/intents/alpha"],
        derivations: {
          "/intents/alpha": derivationWithTierSection(
            [
              "**T1.** Currency: none named.",
              "Amount: none.",
              "Evidence: a plausible gap, not a priced-and-evidenced failure class.",
            ].join("\n"),
          ),
        },
      }),
      bindings: emptyBindings,
      ratifiedMilestones: [],
    });

    expect(gathered).toEqual({
      outcome: "ok",
      value: [
        {
          recordDir: "/intents/alpha",
          derivation: derivationWithTierSection(
            [
              "**T1.** Currency: none named.",
              "Amount: none.",
              "Evidence: a plausible gap, not a priced-and-evidenced failure class.",
            ].join("\n"),
          ),
          claim: {
            kind: "priced-incident",
            currency: null,
            amount: null,
            evidence:
              "a plausible gap, not a priced-and-evidenced failure class.",
          },
          milestoneIsRatified: false,
        },
      ],
    });

    expect(migrationsOf({ gathered })).toEqual([
      {
        kind: "migrated",
        recordDir: "/intents/alpha",
        claimed: "T1",
        assessed: "T3",
      },
    ]);
  });

  test("carries a record whose derivation is absent as a null derivation, not as a failure", () => {
    expect(
      gatherMigrationRecords({
        intentsRoot: "/intents",
        derivations: storeOf({
          recordDirs: ["/intents/alpha"],
          derivations: {},
        }),
        bindings: emptyBindings,
        ratifiedMilestones: [],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          recordDir: "/intents/alpha",
          derivation: null,
          claim: null,
          milestoneIsRatified: false,
        },
      ],
    });
  });

  test("propagates a derivation read failure rather than silently dropping the record", () => {
    const refusingStore: RecordStore = {
      readBinding: () => ({
        outcome: "failed",
        error: {
          kind: "read-failed",
          path: "/intents/alpha",
          detail: "EACCES",
        },
      }),
      writeBinding: () => ({ outcome: "ok", value: undefined }),
      listRecordDirs: () => ({ outcome: "ok", value: ["/intents/alpha"] }),
    };

    expect(
      gatherMigrationRecords({
        intentsRoot: "/intents",
        derivations: refusingStore,
        bindings: emptyBindings,
        ratifiedMilestones: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "read-failed", path: "/intents/alpha", detail: "EACCES" },
    });
  });

  test("propagates a listing failure without reading any record", () => {
    const failingList: RecordStore = {
      readBinding: () => ({ outcome: "ok", value: null }),
      writeBinding: () => ({ outcome: "ok", value: undefined }),
      listRecordDirs: () => ({
        outcome: "failed",
        error: { kind: "read-failed", path: "/intents", detail: "ENOTDIR" },
      }),
    };

    expect(
      gatherMigrationRecords({
        intentsRoot: "/intents",
        derivations: failingList,
        bindings: emptyBindings,
        ratifiedMilestones: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "read-failed", path: "/intents", detail: "ENOTDIR" },
    });
  });

  test("propagates a binding read failure rather than silently dropping the record", () => {
    const refusingBindings: RecordStore = {
      readBinding: () => ({
        outcome: "failed",
        error: {
          kind: "read-failed",
          path: "/intents/alpha",
          detail: "EACCES",
        },
      }),
      writeBinding: () => ({ outcome: "ok", value: undefined }),
      listRecordDirs: () => ({ outcome: "ok", value: ["/intents/alpha"] }),
    };

    expect(
      gatherMigrationRecords({
        intentsRoot: "/intents",
        derivations: storeOf({
          recordDirs: ["/intents/alpha"],
          derivations: {
            "/intents/alpha": derivationWith("**T1 — failure-class removal.**"),
          },
        }),
        bindings: refusingBindings,
        ratifiedMilestones: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "read-failed", path: "/intents/alpha", detail: "EACCES" },
    });
  });

  test("resolves milestoneIsRatified true from a real binding naming a ratified milestone identifier", () => {
    const gathered = gatherMigrationRecords({
      intentsRoot: "/intents",
      derivations: storeOf({
        recordDirs: ["/intents/alpha"],
        derivations: {
          "/intents/alpha": derivationWith("**T1 — failure-class removal.**"),
        },
      }),
      bindings: bindingsStoreOf({
        recordDirs: ["/intents/alpha"],
        bindings: { "/intents/alpha": boundToMilestone("M1") },
      }),
      ratifiedMilestones: ["M1"],
    });

    expect(gathered).toEqual({
      outcome: "ok",
      value: [
        {
          recordDir: "/intents/alpha",
          derivation: derivationWith("**T1 — failure-class removal.**"),
          claim: null,
          milestoneIsRatified: true,
        },
      ],
    });
  });

  test("proves the FR-4 refusal arm is reachable end-to-end: gatherMigrationRecords resolves milestoneIsRatified from a real binding, and feeding that record straight into migrateRecord refuses it", () => {
    const gathered = gatherMigrationRecords({
      intentsRoot: "/intents",
      derivations: storeOf({
        recordDirs: ["/intents/alpha"],
        derivations: {
          "/intents/alpha": derivationWith("**T1 — failure-class removal.**"),
        },
      }),
      bindings: bindingsStoreOf({
        recordDirs: ["/intents/alpha"],
        bindings: { "/intents/alpha": boundToMilestone("M1") },
      }),
      ratifiedMilestones: ["M1"],
    });

    expect(gathered).toEqual({
      outcome: "ok",
      value: [
        {
          recordDir: "/intents/alpha",
          derivation: derivationWith("**T1 — failure-class removal.**"),
          claim: null,
          milestoneIsRatified: true,
        },
      ],
    });

    expect(migrationsOf({ gathered })).toEqual([
      {
        kind: "refused",
        recordDir: "/intents/alpha",
        milestone: "ratified",
        tier: "T1",
      },
    ]);
  });

  test("resolves milestoneIsRatified false when the bound milestone identifier is not in the ratified roster", () => {
    const gathered = gatherMigrationRecords({
      intentsRoot: "/intents",
      derivations: storeOf({
        recordDirs: ["/intents/alpha"],
        derivations: {
          "/intents/alpha": derivationWith("**T1 — failure-class removal.**"),
        },
      }),
      bindings: bindingsStoreOf({
        recordDirs: ["/intents/alpha"],
        bindings: { "/intents/alpha": boundToMilestone("M9") },
      }),
      ratifiedMilestones: ["M1"],
    });

    expect(gathered).toEqual({
      outcome: "ok",
      value: [
        {
          recordDir: "/intents/alpha",
          derivation: derivationWith("**T1 — failure-class removal.**"),
          claim: null,
          milestoneIsRatified: false,
        },
      ],
    });
  });

  test("resolves milestoneIsRatified false when the binding is absent — absent is not ratified", () => {
    const gathered = gatherMigrationRecords({
      intentsRoot: "/intents",
      derivations: storeOf({
        recordDirs: ["/intents/alpha"],
        derivations: {
          "/intents/alpha": derivationWith("**T1 — failure-class removal.**"),
        },
      }),
      bindings: emptyBindings,
      ratifiedMilestones: ["M1"],
    });

    expect(gathered).toEqual({
      outcome: "ok",
      value: [
        {
          recordDir: "/intents/alpha",
          derivation: derivationWith("**T1 — failure-class removal.**"),
          claim: null,
          milestoneIsRatified: false,
        },
      ],
    });
  });

  test("reports a present-but-malformed binding as a loud named failure rather than a silent false", () => {
    expect(
      gatherMigrationRecords({
        intentsRoot: "/intents",
        derivations: storeOf({
          recordDirs: ["/intents/alpha"],
          derivations: {
            "/intents/alpha": derivationWith("**T1 — failure-class removal.**"),
          },
        }),
        bindings: bindingsStoreOf({
          recordDirs: ["/intents/alpha"],
          bindings: { "/intents/alpha": "{not json" },
        }),
        ratifiedMilestones: ["M1"],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "malformed-binding", recordDir: "/intents/alpha" },
    });
  });
});

describe("renderMigrationSummary", () => {
  test("reports the residue split by reason so an ambiguous record is visible, not just counted", () => {
    const summary = renderMigrationSummary({
      report: runTierMigration({
        records: [
          {
            recordDir: "/intents/alpha",
            derivation: derivationWith("**T1 — failure-class removal.**"),
            claim: null,
            milestoneIsRatified: false,
          },
          {
            recordDir: "/intents/beta",
            derivation: derivationWith(
              "T1 — candidate but not clearly cited. The discipline requires T3.",
            ),
            claim: null,
            milestoneIsRatified: false,
          },
        ],
        clock: pinnedClock,
      }),
    });

    expect(summary).toContain("migrated 1");
    expect(summary).toContain("multi-tier-ambiguous 1");
    expect(summary).toContain("2026-09-02T08:00:00.000Z");
  });

  test("ships the derivation commands so the next reader re-runs rather than inherits", () => {
    const summary = renderMigrationSummary({
      report: runTierMigration({ records: [], clock: pinnedClock }),
    });

    expect(summary).toContain("derivation:");
    expect(summary).toContain("pnpm vitest run");
  });
});
