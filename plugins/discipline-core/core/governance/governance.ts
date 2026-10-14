import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { Hit, NativeException } from "../mechanism-port/runner-result-schema.ts";
import type { TouchedSet } from "../touched-set/touched-set.ts";
import { type ClauseAddress, clauseAddressText } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";

export type Finding = Hit & { readonly mechanism: MechanismId };

export type GovernedRun = {
  readonly mechanism: MechanismId;
  readonly nativeExceptions: readonly NativeException[];
  readonly projectedKinds: readonly NativeException["kind"][];
};

export type AttributedNativeException = NativeException & {
  readonly mechanism: MechanismId;
};

export type ExemptedFinding = {
  readonly finding: Finding;
  readonly by: readonly ExceptionRecord[];
};

export type DoublyHeld = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
  readonly mechanism: MechanismId;
};

export type GovernanceRequest = {
  readonly findings: readonly Finding[];
  readonly records: readonly ExceptionRecord[];
  readonly touched: TouchedSet;
  readonly runs: readonly GovernedRun[];
};

export type GovernanceResult = {
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly doublyHeld: readonly DoublyHeld[];
  readonly unrecorded: readonly AttributedNativeException[];
};

const clauseKey = (request: { readonly clause: ClauseAddress }): string =>
  clauseAddressText({ address: request.clause });

const clauseFileKey = (request: {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
}): string => `${clauseKey({ clause: request.clause })} ${request.file}`;

const coverageKeyOf = (request: { readonly record: ExceptionRecord }): string => {
  switch (request.record.kind) {
    case "authorised-location":
    case "file-carve-out":
      return clauseFileKey({ clause: request.record.clause, file: request.record.file });
    case "clause-wide-carve-out":
      return clauseKey({ clause: request.record.clause });
  }
};

const nativeCoverageKeys = (request: {
  readonly exception: NativeException;
}): readonly string[] => {
  switch (request.exception.kind) {
    case "command-line-option":
      return [clauseKey({ clause: request.exception.clause })];
    case "ignore":
    case "config-override":
    case "suppression-entry":
    case "inline-disable":
    case "inline-rule-config":
      return [
        clauseKey({ clause: request.exception.clause }),
        clauseFileKey({ clause: request.exception.clause, file: request.exception.file }),
      ];
  }
};

const forfeitedRecords = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly touched: TouchedSet;
}): readonly ExceptionRecord[] => {
  if (request.touched.measured === "no") {
    return [];
  }
  const touchedPaths = request.touched.paths;
  return request.records.filter(
    (record) => record.kind === "file-carve-out" && touchedPaths.has(record.file),
  );
};

const doublyHeldPairs = (request: {
  readonly inForce: readonly ExceptionRecord[];
}): readonly DoublyHeld[] => {
  const carvedKeys = new Set(
    request.inForce.flatMap((record) =>
      record.kind === "file-carve-out" ? [coverageKeyOf({ record })] : [],
    ),
  );
  return request.inForce.flatMap((record) =>
    record.kind === "authorised-location" && carvedKeys.has(coverageKeyOf({ record }))
      ? [{ clause: record.clause, file: record.file, mechanism: record.mechanism }]
      : [],
  );
};

const unrecordedExceptions = (request: {
  readonly runs: readonly GovernedRun[];
  readonly records: readonly ExceptionRecord[];
}): readonly AttributedNativeException[] =>
  request.runs.flatMap((run) => {
    const recordKeys = new Set(
      request.records.flatMap((record) =>
        record.mechanism === run.mechanism ? [coverageKeyOf({ record })] : [],
      ),
    );
    return run.nativeExceptions.flatMap((exception) =>
      run.projectedKinds.includes(exception.kind) &&
      nativeCoverageKeys({ exception }).some((key) => recordKeys.has(key))
        ? []
        : [{ ...exception, mechanism: run.mechanism }],
    );
  });

export const applyGovernance = (request: GovernanceRequest): GovernanceResult => {
  const forfeited = forfeitedRecords({ records: request.records, touched: request.touched });
  const inForce = request.records.filter((record) => !forfeited.includes(record));
  const doublyHeld = doublyHeldPairs({ inForce });
  const heldKeys = new Set(doublyHeld.map((pair) => clauseFileKey(pair)));
  const exempting = inForce.filter(
    (record) =>
      record.kind === "clause-wide-carve-out" || !heldKeys.has(coverageKeyOf({ record })),
  );
  const judged = request.findings.map((finding) => {
    const findingKeys = [clauseKey(finding), clauseFileKey(finding)];
    return {
      finding,
      by: exempting.filter((record) => findingKeys.includes(coverageKeyOf({ record }))),
    };
  });
  const credited = new Set(judged.flatMap((entry) => entry.by));
  return {
    findings: judged.flatMap((entry) => (entry.by.length === 0 ? [entry.finding] : [])),
    exempted: judged.filter((entry) => entry.by.length > 0),
    stale: exempting.filter((record) => !credited.has(record)),
    forfeited,
    doublyHeld,
    unrecorded: unrecordedExceptions({ runs: request.runs, records: request.records }),
  };
};
