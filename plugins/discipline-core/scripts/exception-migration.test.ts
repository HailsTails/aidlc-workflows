import { describe, expect, it } from "vitest";
import type { ExceptionEntry } from "../core/exception-records/exception-record.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import type { WhyChain } from "../core/values/why-chain.ts";
import {
  compareExceptionMigration,
  type MigrationDisposition,
  type MigrationSourceIdentity,
  type MigrationSourceRecord,
  type VerifiedMigrationSourceSnapshot,
} from "./exception-migration.ts";

const REVISION = "17838b2472be4e54dacb8dafa9f82dba25f7a935";
const SIDECAR = repoPathSchema.parse(".constitution-authorised-locations/cd-19.json");
const DIGEST = "0000000000000000000000000000000000000000000000000000000000000000";
const IMPORT_BOUNDARIES = clauseAddressSchema.parse("CD-19#import-boundaries");
const why = {
  why: "Why does this file declare a class?",
  because: "The vendored parser exports a class the adapter must extend",
  evidence: "vendor/parser/index.d.ts line 12",
};
const whyChain: WhyChain = {
  whys: [why, why, why, why, why],
  rootCause: "The vendored parser's extension point is class-based",
  owner: "260926-vendor-divergence-untrac",
};
const AUTH_ID: MigrationSourceIdentity = {
  revision: REVISION,
  sidecar: SIDECAR,
  entryIndex: 0,
  originalFile: repoPathSchema.parse("src/fictional-authorisation.ts"),
};
const AUTH_SOURCE: MigrationSourceRecord = {
  identity: AUTH_ID,
  kind: "authorised-location",
  originalClause: "CD-19",
  mechanicalClause: IMPORT_BOUNDARIES,
  reason: "fictional unit authorisation; grants no historical permission",
  decision: "fictional unit decision; not a live authorisation",
  whyChain,
};
const AUTH_ENTRY: ExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-19#import-boundaries",
  file: "src/fictional-authorisation.ts",
  reason: AUTH_SOURCE.reason,
  provenance: {
    kind: "existing-authorisation",
    source: "17838b2472be4e54dacb8dafa9f82dba25f7a935:.constitution-authorised-locations/cd-19.json#/0",
    decision: AUTH_SOURCE.decision,
  },
  whyChain,
};
const SNAPSHOT: VerifiedMigrationSourceSnapshot = {
  revision: REVISION,
  sidecar: SIDECAR,
  sha256: DIGEST,
  records: [AUTH_SOURCE],
};
const RETAINED: MigrationDisposition = { kind: "retained", source: AUTH_ID, canonicalIndex: 0 };
const AUTH_REQUEST = { sources: [SNAPSHOT], proposedImports: [AUTH_ENTRY], dispositions: [RETAINED] };
const OTHER_ID: MigrationSourceIdentity = { ...AUTH_ID, entryIndex: 1 };
const PROTOCOL_ID: MigrationSourceIdentity = {
  revision: REVISION, sidecar: SIDECAR, entryIndex: 7,
  originalFile: repoPathSchema.parse("plugins/rin/tools/native-lint/cd14/cd14.eslint-plugin.ts"),
};
const PROTOCOL_SOURCE: MigrationSourceRecord = { ...AUTH_SOURCE, identity: PROTOCOL_ID };
const PROTOCOL_ENTRY: ExceptionEntry = {
  kind: "authorised-location", clause: "CD-19#import-boundaries",
  file: "plugins/discipline-core/mechanisms/oxlint/CD-14/cd14/cd14.eslint-plugin.ts",
  reason: AUTH_SOURCE.reason, whyChain,
  provenance: {
    kind: "existing-authorisation",
    source: "17838b2472be4e54dacb8dafa9f82dba25f7a935:.constitution-authorised-locations/cd-19.json#/7",
    decision: "fictional unit decision; not a live authorisation",
  },
};
const RELOCATION: MigrationDisposition = {
  kind: "relocated-cd14-protocol", source: PROTOCOL_ID, canonicalIndex: 0,
  originalArtifactSha256: DIGEST, successorArtifactSha256: DIGEST,
};
const PROTOCOL_REQUEST = {
  sources: [{ ...SNAPSHOT, records: [PROTOCOL_SOURCE] }],
  proposedImports: [PROTOCOL_ENTRY], dispositions: [RELOCATION],
};

describe("one-time exception source comparison", () => {
  it("retains proposed order, supplied chains, absent history and retired source rows", () => {
    const debtId: MigrationSourceIdentity = { ...AUTH_ID, entryIndex: 1, originalFile: repoPathSchema.parse("src/fictional-debt.ts") };
    const unchainedId: MigrationSourceIdentity = { ...AUTH_ID, entryIndex: 2, originalFile: repoPathSchema.parse("src/fictional-unchained.ts") };
    const retiredId: MigrationSourceIdentity = { ...AUTH_ID, entryIndex: 3, originalFile: repoPathSchema.parse("src/fictional-removed.ts") };
    const debt: MigrationSourceRecord = {
      identity: debtId, kind: "file-carve-out", originalClause: "CD-20", mechanicalClause: IMPORT_BOUNDARIES,
      reason: "fictional unit inherited debt", decision: "fictional initial baseline decision",
    };
    const unchained: MigrationSourceRecord = {
      identity: unchainedId, kind: "authorised-location", originalClause: "CD-19", mechanicalClause: IMPORT_BOUNDARIES,
      reason: "fictional unit authorisation without supplied chain or decision",
    };
    const retired: MigrationSourceRecord = { ...AUTH_SOURCE, identity: retiredId };
    const snapshot: VerifiedMigrationSourceSnapshot = { ...SNAPSHOT, records: [AUTH_SOURCE, debt, unchained, retired] };
    const debtEntry: ExceptionEntry = {
      kind: "file-carve-out", clause: "CD-19#import-boundaries", file: "src/fictional-debt.ts", reason: debt.reason,
      provenance: { kind: "inherited-debt", source: "17838b2472be4e54dacb8dafa9f82dba25f7a935:.constitution-authorised-locations/cd-19.json#/1", decision: "fictional initial baseline decision" },
    };
    const unchainedEntry: ExceptionEntry = {
      kind: "authorised-location", clause: "CD-19#import-boundaries", file: "src/fictional-unchained.ts", reason: unchained.reason,
      provenance: { kind: "existing-authorisation", source: "17838b2472be4e54dacb8dafa9f82dba25f7a935:.constitution-authorised-locations/cd-19.json#/2" },
    };
    const dispositions: readonly MigrationDisposition[] = [
      { kind: "retained", source: AUTH_ID, canonicalIndex: 1 },
      { kind: "retired", source: retiredId, reason: "source-file-removed" },
      { kind: "retained", source: debtId, canonicalIndex: 2 },
      { kind: "retained", source: unchainedId, canonicalIndex: 0 },
    ];

    expect(compareExceptionMigration({ sources: [snapshot], proposedImports: [unchainedEntry, AUTH_ENTRY, debtEntry], dispositions })).toEqual({
      outcome: "ok", value: { entries: [unchainedEntry, AUTH_ENTRY, debtEntry], sources: [snapshot], dispositions },
    });
  });

  it("requires a disposition for an additional expanded source row", () => {
    const source: MigrationSourceRecord = { ...AUTH_SOURCE, identity: { ...AUTH_ID, originalFile: repoPathSchema.parse("src/fictional-second-file.ts") } };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, sources: [{ ...SNAPSHOT, records: [AUTH_SOURCE, source] }] })).toEqual({
      outcome: "failed", error: { kind: "source-disposition-missing", source: source.identity },
    });
  });

  it("accounts separately for identical assertions at different original indexes", () => {
    const source: MigrationSourceRecord = { ...AUTH_SOURCE, identity: OTHER_ID };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, sources: [{ ...SNAPSHOT, records: [AUTH_SOURCE, source] }] })).toEqual({
      outcome: "failed", error: { kind: "source-disposition-missing", source: OTHER_ID },
    });
  });

  it.each([
    { name: "duplicate source identity", snapshot: { ...SNAPSHOT, records: [AUTH_SOURCE, AUTH_SOURCE] } },
    { name: "snapshot and record sidecar disagreement", snapshot: { ...SNAPSHOT, sidecar: repoPathSchema.parse(".constitution-authorised-locations/cd-5.json") } },
  ])("refuses $name", ({ snapshot }) => {
    expect(compareExceptionMigration({ ...AUTH_REQUEST, sources: [snapshot] })).toMatchObject({
      outcome: "failed", error: { kind: "source-inventory-mismatch", detail: expect.stringMatching(/\S/) },
    });
  });

  it("refuses a disposition whose source is not in the supplied population", () => {
    expect(compareExceptionMigration({ ...AUTH_REQUEST, dispositions: [RETAINED, { kind: "retired", source: OTHER_ID, reason: "source-file-removed" }] })).toEqual({
      outcome: "failed", error: { kind: "source-identity-unresolved", source: OTHER_ID },
    });
  });

  it("refuses a second disposition for one source identity", () => {
    expect(compareExceptionMigration({ ...AUTH_REQUEST, dispositions: [RETAINED, { kind: "retired", source: AUTH_ID, reason: "source-file-removed" }] })).toEqual({
      outcome: "failed", error: { kind: "source-disposition-duplicated", source: AUTH_ID },
    });
  });

  it("refuses an unsourced additional canonical location", () => {
    const newLocation: ExceptionEntry = { ...AUTH_ENTRY, file: "src/fictional-new-structural-boundary.ts" };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, proposedImports: [AUTH_ENTRY, newLocation] })).toEqual({
      outcome: "failed", error: { kind: "canonical-import-unsourced", canonicalIndex: 1 },
    });
  });

  it("refuses mapping two independently indexed sources onto one canonical entry", () => {
    const source: MigrationSourceRecord = { ...AUTH_SOURCE, identity: OTHER_ID };

    expect(compareExceptionMigration({ ...AUTH_REQUEST,
      sources: [{ ...SNAPSHOT, records: [AUTH_SOURCE, source] }],
      dispositions: [RETAINED, { kind: "retained", source: OTHER_ID, canonicalIndex: 0 }],
    })).toEqual({ outcome: "failed", error: { kind: "canonical-mapping-duplicated", canonicalIndex: 0 } });
  });

  it.each<{ readonly field: "clause" | "file" | "reason" | "source" | "decision" | "why-chain"; readonly entry: ExceptionEntry }>([
    { field: "clause", entry: { ...AUTH_ENTRY, clause: "CD-5#comments-directives" } },
    { field: "file", entry: { ...AUTH_ENTRY, file: "src/fictional-broader-scope.ts" } },
    { field: "reason", entry: { ...AUTH_ENTRY, reason: "fictional altered reason" } },
    { field: "source", entry: { ...AUTH_ENTRY, provenance: { kind: "existing-authorisation", source: "fictional unsourced pointer", decision: AUTH_SOURCE.decision } } },
    { field: "decision", entry: { ...AUTH_ENTRY, provenance: { kind: "existing-authorisation", source: "17838b2472be4e54dacb8dafa9f82dba25f7a935:.constitution-authorised-locations/cd-19.json#/0", decision: "fictional altered decision" } } },
    { field: "why-chain", entry: { ...AUTH_ENTRY, whyChain: { ...whyChain, owner: "fictional changed chain owner" } } },
  ])("refuses changed $field evidence rather than admitting a partial result", ({ field, entry }) => {
    expect(compareExceptionMigration({ ...AUTH_REQUEST, proposedImports: [entry] })).toEqual({
      outcome: "failed", error: { kind: "canonical-record-mismatch", source: AUTH_ID, canonicalIndex: 0, field },
    });
  });

  it("refuses changing an authorisation into debt", () => {
    const entry: ExceptionEntry = {
      kind: "file-carve-out", clause: AUTH_ENTRY.clause, file: "src/fictional-authorisation.ts", reason: AUTH_SOURCE.reason,
      whyChain, provenance: { kind: "inherited-debt", source: "17838b2472be4e54dacb8dafa9f82dba25f7a935:.constitution-authorised-locations/cd-19.json#/0", decision: "fictional unit decision; not a live authorisation" },
    };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, proposedImports: [entry] })).toMatchObject({
      outcome: "failed", error: { kind: "canonical-record-mismatch", source: AUTH_ID, canonicalIndex: 0 },
    });
  });

  it("refuses discarding a supplied chain even when provenance remains", () => {
    const entry: ExceptionEntry = {
      kind: "authorised-location", clause: AUTH_ENTRY.clause, file: "src/fictional-authorisation.ts", reason: AUTH_SOURCE.reason,
      provenance: { kind: "existing-authorisation", source: "17838b2472be4e54dacb8dafa9f82dba25f7a935:.constitution-authorised-locations/cd-19.json#/0", decision: AUTH_SOURCE.decision },
    };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, proposedImports: [entry] })).toEqual({
      outcome: "failed", error: { kind: "canonical-record-mismatch", source: AUTH_ID, canonicalIndex: 0, field: "why-chain" },
    });
  });

  it("refuses inventing an absent historical chain or decision", () => {
    const source: MigrationSourceRecord = {
      identity: AUTH_ID, kind: "authorised-location", originalClause: "CD-19", mechanicalClause: IMPORT_BOUNDARIES, reason: AUTH_SOURCE.reason,
    };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, sources: [{ ...SNAPSHOT, records: [source] }] })).toMatchObject({
      outcome: "failed", error: { kind: "canonical-record-mismatch", source: AUTH_ID, canonicalIndex: 0 },
    });
  });

  it("refuses changing only the final Why evidence while preserving the remaining chain", () => {
    const entry: ExceptionEntry = {
      ...AUTH_ENTRY,
      whyChain: {
        ...whyChain,
        whys: [why, why, why, why, { ...why, evidence: "fictional altered final Why evidence" }],
      },
    };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, proposedImports: [entry] })).toEqual({
      outcome: "failed", error: { kind: "canonical-record-mismatch", source: AUTH_ID, canonicalIndex: 0, field: "why-chain" },
    });
  });

  it("refuses an invented chain alone while preserving the original decision", () => {
    const source: MigrationSourceRecord = {
      identity: AUTH_ID, kind: "authorised-location", originalClause: "CD-19", mechanicalClause: IMPORT_BOUNDARIES,
      reason: AUTH_SOURCE.reason, decision: "fictional unit decision; not a live authorisation",
    };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, sources: [{ ...SNAPSHOT, records: [source] }] })).toEqual({
      outcome: "failed", error: { kind: "canonical-record-mismatch", source: AUTH_ID, canonicalIndex: 0, field: "why-chain" },
    });
  });

  it("refuses a fully mapped CD1 any-clause exception", () => {
    const clause = clauseAddressSchema.parse("CD-1#any-cast");
    const source: MigrationSourceRecord = { ...AUTH_SOURCE, originalClause: "CD-1", mechanicalClause: clause };
    const entry: ExceptionEntry = { ...AUTH_ENTRY, clause: "CD-1#any-cast" };

    expect(compareExceptionMigration({ ...AUTH_REQUEST, sources: [{ ...SNAPSHOT, records: [source] }], proposedImports: [entry] })).toEqual({
      outcome: "failed", error: { kind: "non-exemptible-clause", canonicalIndex: 0, clause },
    });
  });

  it("refuses a disposition beyond the proposed canonical population", () => {
    expect(compareExceptionMigration({ ...AUTH_REQUEST, dispositions: [{ kind: "retained", source: AUTH_ID, canonicalIndex: 1 }] })).toMatchObject({
      outcome: "failed", error: { kind: "disposition-refused", source: AUTH_ID, detail: expect.stringMatching(/\S/) },
    });
  });

  it("admits only the specified production relocation with equal fictional artifact digests", () => {
    expect(compareExceptionMigration(PROTOCOL_REQUEST)).toEqual({
      outcome: "ok", value: {
        entries: [PROTOCOL_ENTRY], sources: [{ ...SNAPSHOT, records: [PROTOCOL_SOURCE] }], dispositions: [RELOCATION],
      },
    });
  });

  it("refuses transferring the production permission to another destination", () => {
    const entry: ExceptionEntry = { ...PROTOCOL_ENTRY, file: "plugins/discipline-core/mechanisms/oxlint/CD-14/cd14/fictional-other.ts" };

    expect(compareExceptionMigration({ ...PROTOCOL_REQUEST, proposedImports: [entry] })).toMatchObject({
      outcome: "failed", error: { kind: "disposition-refused", source: PROTOCOL_ID, detail: expect.stringMatching(/\S/) },
    });
  });

  it("refuses relocating the old test permission", () => {
    const sourceId: MigrationSourceIdentity = { ...PROTOCOL_ID, originalFile: repoPathSchema.parse("plugins/rin/tools/native-lint/cd14/cd14.eslint-plugin.test.ts") };
    const source: MigrationSourceRecord = { ...PROTOCOL_SOURCE, identity: sourceId };

    expect(compareExceptionMigration({
      ...PROTOCOL_REQUEST, sources: [{ ...SNAPSHOT, records: [source] }],
      dispositions: [{ kind: "relocated-cd14-protocol", source: sourceId, canonicalIndex: 0, originalArtifactSha256: DIGEST, successorArtifactSha256: DIGEST }],
    })).toMatchObject({
      outcome: "failed", error: { kind: "disposition-refused", source: sourceId, detail: expect.stringMatching(/\S/) },
    });
  });

  it.each([
    { name: "unequal fictional artifacts", originalArtifactSha256: DIGEST, successorArtifactSha256: "1111111111111111111111111111111111111111111111111111111111111111" },
    { name: "equal malformed artifact identities", originalArtifactSha256: "fictional digest", successorArtifactSha256: "fictional digest" },
  ])("refuses $name", ({ originalArtifactSha256, successorArtifactSha256 }) => {
    expect(compareExceptionMigration({ ...PROTOCOL_REQUEST,
      dispositions: [{ kind: "relocated-cd14-protocol", source: PROTOCOL_ID, canonicalIndex: 0, originalArtifactSha256, successorArtifactSha256 }],
    })).toMatchObject({
      outcome: "failed", error: { kind: "disposition-refused", source: PROTOCOL_ID, detail: expect.stringMatching(/\S/) },
    });
  });
});
