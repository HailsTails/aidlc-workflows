import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { ProjectionWrite } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import {
  type ClauseAddress,
  clauseAddressText,
  sameClauseAddress,
} from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";

export type ProjectedClause = {
  readonly address: ClauseAddress;
  readonly ruleId: string;
};

export type ProjectedPiece = {
  readonly pluginNamespace: string;
  readonly pluginImport: string;
  readonly clauses: readonly ProjectedClause[];
};

export type CurrentProjection =
  | { readonly presence: "absent" }
  | { readonly presence: "present"; readonly text: string };

export type GeneratedProjectionState = "current" | "out-of-date" | "missing";

type RuleSeverity = "error" | "off";

type FileRecord = Exclude<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>;

type ClauseWideRecord = Extract<ExceptionRecord, { readonly kind: "clause-wide-carve-out" }>;

const PROJECTED_MECHANISM = "eslint";

const PROJECTION_PATH: RepoPath = repoPathSchema.parse("disciplines.eslint.mjs");

const SOURCE_FILES = "**/*.{ts,tsx,mts,cts}";

const GLOB_SPECIAL_CHARACTERS = /[\\*?[\]{}()!+@]/g;

const PARENT_PREFIX = "../";

const codeUnitOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left < request.right) {
    return -1;
  }
  return request.left > request.right ? 1 : 0;
};

const quoted = (request: { readonly text: string }): string => JSON.stringify(request.text);

export const escapedGlobPath = (request: { readonly path: string }): string =>
  request.path.replace(GLOB_SPECIAL_CHARACTERS, (character) => `\\${character}`);

export const pluginImportOf = (request: {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly pieceRoot: string;
  readonly pluginModule: string;
}): string => {
  const relativeImport = request.path.relative({
    from: request.repoRoot,
    to: request.path.join({ segments: [request.pieceRoot, request.pluginModule] }),
  });
  return relativeImport.startsWith(PARENT_PREFIX) ? relativeImport : `./${relativeImport}`;
};

const rulesLine = (request: {
  readonly ruleIds: readonly string[];
  readonly severity: RuleSeverity;
}): string =>
  `    rules: { ${request.ruleIds
    .map((ruleId) => `${quoted({ text: ruleId })}: ${quoted({ text: request.severity })}`)
    .join(", ")} },`;

const blockText = (request: { readonly lines: readonly string[] }): string =>
  ["  {", ...request.lines, "  },"].join("\n");

const pieceBlock = (request: {
  readonly piece: ProjectedPiece;
  readonly importName: string;
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({ text: `discipline-core/piece/${request.piece.pluginNamespace}` })},`,
      `    files: [${quoted({ text: SOURCE_FILES })}],`,
      `    plugins: { ${quoted({ text: request.piece.pluginNamespace })}: ${request.importName} },`,
      rulesLine({
        ruleIds: request.piece.clauses
          .map((clause) => clause.ruleId)
          .sort((left, right) => codeUnitOrder({ left, right })),
        severity: "error",
      }),
    ],
  });

const ruleIdsOfClause = (request: {
  readonly pieces: readonly ProjectedPiece[];
  readonly address: ClauseAddress;
}): readonly string[] =>
  request.pieces
    .flatMap((piece) => piece.clauses)
    .filter(
      (clause) => sameClauseAddress({ left: clause.address, right: request.address }) === "same",
    )
    .map((clause) => clause.ruleId)
    .sort((left, right) => codeUnitOrder({ left, right }));

const fileRecordBlock = (request: {
  readonly record: FileRecord;
  readonly pieces: readonly ProjectedPiece[];
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({
        text: `discipline-core/${request.record.kind}/${clauseAddressText({ address: request.record.clause })}/${request.record.file}`,
      })},`,
      `    files: [${quoted({ text: escapedGlobPath({ path: request.record.file }) })}],`,
      rulesLine({
        ruleIds: ruleIdsOfClause({ pieces: request.pieces, address: request.record.clause }),
        severity: "off",
      }),
    ],
  });

const clauseWideBlock = (request: {
  readonly record: ClauseWideRecord;
  readonly pieces: readonly ProjectedPiece[];
}): string =>
  blockText({
    lines: [
      `    name: ${quoted({
        text: `discipline-core/${request.record.kind}/${clauseAddressText({ address: request.record.clause })}`,
      })},`,
      rulesLine({
        ruleIds: ruleIdsOfClause({ pieces: request.pieces, address: request.record.clause }),
        severity: "off",
      }),
    ],
  });

export const projectionText = (request: {
  readonly selectedPieces: readonly ProjectedPiece[];
  readonly records: readonly ExceptionRecord[];
}): string => {
  const pieces = [...request.selectedPieces].sort((left, right) =>
    codeUnitOrder({ left: left.pluginNamespace, right: right.pluginNamespace }),
  );
  const projectedRecords = request.records.filter(
    (record) => record.mechanism === PROJECTED_MECHANISM,
  );
  const fileRecords = projectedRecords
    .flatMap((record) => (record.kind === "clause-wide-carve-out" ? [] : [record]))
    .sort(
      (left, right) =>
        codeUnitOrder({
          left: clauseAddressText({ address: left.clause }),
          right: clauseAddressText({ address: right.clause }),
        }) || codeUnitOrder({ left: left.file, right: right.file }),
    );
  const clauseWideRecords = projectedRecords
    .flatMap((record) => (record.kind === "clause-wide-carve-out" ? [record] : []))
    .sort((left, right) =>
      codeUnitOrder({
        left: clauseAddressText({ address: left.clause }),
        right: clauseAddressText({ address: right.clause }),
      }),
    );
  const imports = pieces.map(
    (piece, index) => `import piece${index} from ${quoted({ text: piece.pluginImport })};`,
  );
  const blocks = [
    ...pieces.map((piece, index) => pieceBlock({ piece, importName: `piece${index}` })),
    ...fileRecords.map((record) => fileRecordBlock({ record, pieces })),
    ...clauseWideRecords.map((record) => clauseWideBlock({ record, pieces })),
  ];
  return `${imports.join("\n")}\n\nexport default [\n${blocks.join("\n")}\n];\n`;
};

export const projectionState = (request: {
  readonly current: CurrentProjection;
  readonly generated: string;
}): GeneratedProjectionState => {
  if (request.current.presence === "absent") {
    return "missing";
  }
  return request.current.text === request.generated ? "current" : "out-of-date";
};

export const writeProjection = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly text: string;
}): Result<ProjectionWrite, RunnerFailure> => {
  const absolutePath = `${request.repoRoot}/${PROJECTION_PATH}`;
  if (request.fileText.exists({ path: absolutePath }) === "present") {
    const current = request.fileText.read({ path: absolutePath });
    if (current.outcome === "failed") {
      return {
        outcome: "failed",
        error: { kind: "file-unreadable", file: PROJECTION_PATH, detail: current.error.detail },
      };
    }
    if (current.value === request.text) {
      return { outcome: "ok", value: { path: PROJECTION_PATH, effect: "unchanged" } };
    }
  }
  const written = request.fileText.write({ path: absolutePath, text: request.text });
  if (written.outcome === "failed") {
    return { outcome: "failed", error: { kind: "tool-failed", detail: written.error.detail } };
  }
  return { outcome: "ok", value: { path: PROJECTION_PATH, effect: "written" } };
};
