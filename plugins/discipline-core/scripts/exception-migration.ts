import type { ExceptionEntry } from "../core/exception-records/exception-record.ts";
import { type ClauseAddress, clauseAddressSchema, sameClauseAddress } from "../core/values/clause-address.ts";
import type { RepoPath } from "../core/values/repo-path.ts";
import type { Result } from "../core/values/result.ts";
import type { WhyChain } from "../core/values/why-chain.ts";

export type MigrationBaselineRevision =
  "17838b2472be4e54dacb8dafa9f82dba25f7a935";

export type MigrationSourceIdentity = {
  readonly revision: MigrationBaselineRevision;
  readonly sidecar: RepoPath;
  readonly entryIndex: number;
  readonly originalFile: RepoPath;
};

export type MigrationSourceRecord = {
  readonly identity: MigrationSourceIdentity;
  readonly kind: "authorised-location" | "file-carve-out";
  readonly originalClause: string;
  readonly mechanicalClause: ClauseAddress;
  readonly reason: string;
  readonly decision?: string;
  readonly whyChain?: WhyChain;
};

export type VerifiedMigrationSourceSnapshot = {
  readonly revision: MigrationBaselineRevision;
  readonly sidecar: RepoPath;
  readonly sha256: string;
  readonly records: readonly MigrationSourceRecord[];
};

export type MigrationDisposition =
  | {
      readonly kind: "retained";
      readonly source: MigrationSourceIdentity;
      readonly canonicalIndex: number;
    }
  | {
      readonly kind: "relocated-cd14-protocol";
      readonly source: MigrationSourceIdentity;
      readonly canonicalIndex: number;
      readonly originalArtifactSha256: string;
      readonly successorArtifactSha256: string;
    }
  | {
      readonly kind: "retired";
      readonly source: MigrationSourceIdentity;
      readonly reason:
        | "source-file-removed"
        | "obsolete-sdk-location"
        | "whole-file-paydown";
    };

export type AdmittedExceptionMigration = {
  readonly entries: readonly ExceptionEntry[];
  readonly sources: readonly VerifiedMigrationSourceSnapshot[];
  readonly dispositions: readonly MigrationDisposition[];
};

export type MigrationComparisonFailure =
  | {
      readonly kind: "source-inventory-mismatch";
      readonly detail: string;
    }
  | {
      readonly kind: "source-identity-unresolved";
      readonly source: MigrationSourceIdentity;
    }
  | {
      readonly kind: "source-disposition-missing";
      readonly source: MigrationSourceIdentity;
    }
  | {
      readonly kind: "source-disposition-duplicated";
      readonly source: MigrationSourceIdentity;
    }
  | {
      readonly kind: "canonical-import-unsourced";
      readonly canonicalIndex: number;
    }
  | {
      readonly kind: "canonical-mapping-duplicated";
      readonly canonicalIndex: number;
    }
  | {
      readonly kind: "canonical-record-mismatch";
      readonly source: MigrationSourceIdentity;
      readonly canonicalIndex: number;
      readonly field:
        | "kind"
        | "clause"
        | "file"
        | "reason"
        | "source"
        | "decision"
        | "why-chain";
    }
  | {
      readonly kind: "disposition-refused";
      readonly source: MigrationSourceIdentity;
      readonly detail: string;
    }
  | {
      readonly kind: "non-exemptible-clause";
      readonly canonicalIndex: number;
      readonly clause: ClauseAddress;
    };

type CanonicalMismatchField = Extract<MigrationComparisonFailure, { readonly kind: "canonical-record-mismatch" }>["field"];

const BASELINE_REVISION: MigrationBaselineRevision = "17838b2472be4e54dacb8dafa9f82dba25f7a935";
const SHA256 = /^[0-9a-f]{64}$/;

const sourceIdentityMatch = (request: {
  readonly left: MigrationSourceIdentity;
  readonly right: MigrationSourceIdentity;
}): "same" | "different" =>
  request.left.revision === request.right.revision &&
  request.left.sidecar === request.right.sidecar &&
  request.left.entryIndex === request.right.entryIndex &&
  request.left.originalFile === request.right.originalFile ? "same" : "different";

const inventoryFailure = (request: {
  readonly snapshots: readonly VerifiedMigrationSourceSnapshot[];
  readonly records: readonly MigrationSourceRecord[];
}): MigrationComparisonFailure | undefined => {
  const inconsistent = request.snapshots.find((snapshot, index) =>
    snapshot.revision !== BASELINE_REVISION || !SHA256.test(snapshot.sha256) ||
    request.snapshots.slice(0, index).some((prior) => prior.sidecar === snapshot.sidecar) ||
    snapshot.records.some((record) =>
      record.identity.revision !== snapshot.revision || record.identity.sidecar !== snapshot.sidecar ||
      !Number.isSafeInteger(record.identity.entryIndex) || record.identity.entryIndex < 0));
  if (inconsistent !== undefined) {
    return { kind: "source-inventory-mismatch", detail: `inconsistent snapshot or record identity: ${inconsistent.sidecar}` };
  }
  const duplicate = request.records.find((record, index) =>
    request.records.slice(0, index).some((prior) => sourceIdentityMatch({ left: prior.identity, right: record.identity }) === "same"));
  return duplicate === undefined ? undefined : {
    kind: "source-inventory-mismatch",
    detail: `duplicate source identity: ${duplicate.identity.sidecar}#/${duplicate.identity.entryIndex} ${duplicate.identity.originalFile}`,
  };
};

const accountingFailure = (request: {
  readonly records: readonly MigrationSourceRecord[];
  readonly dispositions: readonly MigrationDisposition[];
  readonly canonicalCount: number;
}): MigrationComparisonFailure | undefined => {
  const unresolved = request.dispositions.find((disposition) =>
    !request.records.some((record) => sourceIdentityMatch({ left: record.identity, right: disposition.source }) === "same"));
  if (unresolved !== undefined) return { kind: "source-identity-unresolved", source: unresolved.source };
  const sourceAccounting = request.records.map((record) => ({
    source: record.identity,
    count: request.dispositions.filter((disposition) => sourceIdentityMatch({ left: record.identity, right: disposition.source }) === "same").length,
  }));
  const missing = sourceAccounting.find((source) => source.count === 0);
  if (missing !== undefined) return { kind: "source-disposition-missing", source: missing.source };
  const duplicated = sourceAccounting.find((source) => source.count > 1);
  if (duplicated !== undefined) return { kind: "source-disposition-duplicated", source: duplicated.source };
  const invalidIndex = request.dispositions.find((disposition) => disposition.kind !== "retired" &&
    (!Number.isSafeInteger(disposition.canonicalIndex) || disposition.canonicalIndex < 0 || disposition.canonicalIndex >= request.canonicalCount));
  if (invalidIndex !== undefined) {
    return { kind: "disposition-refused", source: invalidIndex.source, detail: "canonical index is outside the proposed population" };
  }
  const canonicalCounts = Array.from({ length: request.canonicalCount }, (_entry, index) => ({
    index,
    count: request.dispositions.filter((disposition) => disposition.kind !== "retired" && disposition.canonicalIndex === index).length,
  }));
  const unsourced = canonicalCounts.find((canonical) => canonical.count === 0);
  if (unsourced !== undefined) return { kind: "canonical-import-unsourced", canonicalIndex: unsourced.index };
  const duplicateMapping = canonicalCounts.find((canonical) => canonical.count > 1);
  return duplicateMapping === undefined ? undefined : { kind: "canonical-mapping-duplicated", canonicalIndex: duplicateMapping.index };
};

const chainMatch = (request: {
  readonly left: WhyChain | undefined;
  readonly right: WhyChain | undefined;
}): "same" | "different" => {
  const { left, right } = request;
  if (left === undefined || right === undefined) return left === right ? "same" : "different";
  return left.owner === right.owner && left.rootCause === right.rootCause &&
    left.whys.every((why, index) => {
      const other = right.whys[index];
      return other !== undefined && why.why === other.why && why.because === other.because && why.evidence === other.evidence;
    }) ? "same" : "different";
};

const relocationFailure = (request: {
  readonly source: MigrationSourceRecord;
  readonly entry: ExceptionEntry;
  readonly disposition: MigrationDisposition;
}): MigrationComparisonFailure | undefined => {
  if (request.disposition.kind !== "relocated-cd14-protocol") return undefined;
  const { source, entry, disposition } = request;
  const identity = source.identity;
  if (identity.revision !== BASELINE_REVISION ||
    identity.sidecar !== ".constitution-authorised-locations/cd-19.json" || identity.entryIndex !== 7 ||
    identity.originalFile !== "plugins/rin/tools/native-lint/cd14/cd14.eslint-plugin.ts" ||
    source.kind !== "authorised-location" || source.originalClause !== "CD-19" ||
    source.mechanicalClause.ruleSet !== "shared" || source.mechanicalClause.discipline !== "CD-19" ||
    source.mechanicalClause.clause !== "import-boundaries" ||
    entry.kind !== "authorised-location" ||
    entry.file !== "plugins/discipline-core/mechanisms/oxlint/CD-14/cd14/cd14.eslint-plugin.ts" ||
    !SHA256.test(disposition.originalArtifactSha256) || !SHA256.test(disposition.successorArtifactSha256) ||
    disposition.originalArtifactSha256 !== disposition.successorArtifactSha256) {
    return { kind: "disposition-refused", source: identity, detail: "relocation is not the specified byte-identical CD14 production protocol artifact" };
  }
  return undefined;
};

const recordMismatch = (request: {
  readonly source: MigrationSourceIdentity;
  readonly canonicalIndex: number;
  readonly field: CanonicalMismatchField;
}): MigrationComparisonFailure => ({ kind: "canonical-record-mismatch", ...request });

const recordFailure = (request: {
  readonly source: MigrationSourceRecord;
  readonly entry: ExceptionEntry;
  readonly disposition: Exclude<MigrationDisposition, { readonly kind: "retired" }>;
}): MigrationComparisonFailure | undefined => {
  const { source, entry, disposition } = request;
  const mismatch = (request: { readonly field: CanonicalMismatchField }): MigrationComparisonFailure =>
    recordMismatch({ source: source.identity, canonicalIndex: disposition.canonicalIndex, field: request.field });
  const parsedClause = clauseAddressSchema.safeParse(entry.clause);
  if (!parsedClause.success) return mismatch({ field: "clause" });
  if (parsedClause.data.discipline === "CD-1") {
    return { kind: "non-exemptible-clause", canonicalIndex: disposition.canonicalIndex, clause: parsedClause.data };
  }
  const relocation = relocationFailure(request);
  if (relocation !== undefined) return relocation;
  if (entry.kind === "clause-wide-carve-out" || entry.kind !== source.kind) return mismatch({ field: "kind" });
  if (sameClauseAddress({ left: parsedClause.data, right: source.mechanicalClause }) !== "same") return mismatch({ field: "clause" });
  if (disposition.kind === "retained" && entry.file !== source.identity.originalFile) return mismatch({ field: "file" });
  if (entry.reason !== source.reason) return mismatch({ field: "reason" });
  const expectedSource = `${source.identity.revision}:${source.identity.sidecar}#/${source.identity.entryIndex}`;
  const expectedProvenanceKind = source.kind === "authorised-location" ? "existing-authorisation" : "inherited-debt";
  if (entry.provenance?.source !== expectedSource || entry.provenance.kind !== expectedProvenanceKind) return mismatch({ field: "source" });
  if (entry.provenance.decision !== source.decision) return mismatch({ field: "decision" });
  if (chainMatch({ left: source.whyChain, right: entry.whyChain }) !== "same") return mismatch({ field: "why-chain" });
  return undefined;
};

export const compareExceptionMigration = (request: {
  readonly sources: readonly VerifiedMigrationSourceSnapshot[];
  readonly proposedImports: readonly ExceptionEntry[];
  readonly dispositions: readonly MigrationDisposition[];
}): Result<AdmittedExceptionMigration, MigrationComparisonFailure> => {
  const records = request.sources.flatMap((snapshot) => snapshot.records);
  const inventory = inventoryFailure({ snapshots: request.sources, records });
  if (inventory !== undefined) return { outcome: "failed", error: inventory };
  const accounting = accountingFailure({ records, dispositions: request.dispositions, canonicalCount: request.proposedImports.length });
  if (accounting !== undefined) return { outcome: "failed", error: accounting };
  const compared = request.dispositions.reduce<MigrationComparisonFailure | undefined>((failure, disposition) => {
    if (failure !== undefined || disposition.kind === "retired") return failure;
    const source = records.find((record) => sourceIdentityMatch({ left: record.identity, right: disposition.source }) === "same");
    if (source === undefined) return { kind: "source-identity-unresolved", source: disposition.source };
    const entry = request.proposedImports[disposition.canonicalIndex];
    if (entry === undefined) return { kind: "disposition-refused", source: disposition.source, detail: "canonical index is outside the proposed population" };
    return recordFailure({ source, entry, disposition });
  }, undefined);
  return compared === undefined ? {
    outcome: "ok",
    value: { entries: request.proposedImports, sources: request.sources, dispositions: request.dispositions },
  } : { outcome: "failed", error: compared };
};
