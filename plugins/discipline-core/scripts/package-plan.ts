import { z } from "zod";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";

export type PlanFailure = { readonly kind: "piece-invalid"; readonly path: string; readonly detail: string };

export type PieceText = { readonly path: string; readonly text: string };

export type CommandEntries = { readonly check: string; readonly project: string };

export type PackagePlan = {
  readonly entryPoints: readonly string[];
  readonly commands: CommandEntries;
  readonly copied: readonly string[];
  readonly pieces: readonly PieceText[];
};

export type BundledPackage = {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly licenseText: string;
  readonly noticeText: string | undefined;
};

export const SHIPPED_NODE_RANGE = "^22.13.0 || >=24";

export const SHIPPED_NODE_TARGET = "node22.13";

const SOURCE_MODULE_EXTENSION = ".ts";

const BUILT_MODULE_EXTENSION = ".js";

const COMMAND_SOURCES: CommandEntries = {
  check: "core/check/check-command.ts",
  project: "core/check/project-command.ts",
};

const RUNNER_ENTRY = /^mechanisms\/[^/]+\/runner\/runner\.ts$/;

const PIECE_FILE = /^mechanisms\/([^/]+)\/([^/]+)\/piece\.json$/;

const RUNNER_FOLDER = "runner";

const SHIPPED_DOCUMENTS = new Set(["README.md", "ADOPTING.md", "LICENSE", "docs/why-chain-contract.md"]);

const SHIPPED_DATA = [/^rules\/[^/]+\/discipline\.json$/, /^rules\/.+\.md$/, /^methods\/.+\.md$/];

const TEST_FOLDERS = new Set(["tests", "test-fixtures"]);

const TEST_FILE_SUFFIX = ".test.ts";

const pieceModuleSettingsSchema = z.looseObject({
  module: z.string().optional(),
  pluginModule: z.string().optional(),
});

const pieceFileSchema = z.looseObject({
  clauses: z.array(z.looseObject({ settings: pieceModuleSettingsSchema })),
});

const PIECE_MODULE_KEYS: ReadonlySet<string> = new Set(pieceModuleSettingsSchema.keyof().options);

type PieceFile = z.infer<typeof pieceFileSchema>;

type PieceModuleSettings = z.infer<typeof pieceModuleSettingsSchema>;

type SourceForm = "shipped" | "test-only";

const sourceFormOf = (request: { readonly path: string }): SourceForm =>
  request.path.endsWith(TEST_FILE_SUFFIX) || request.path.split("/").some((segment) => TEST_FOLDERS.has(segment))
    ? "test-only"
    : "shipped";

const shippedPaths = (request: { readonly sourcePaths: readonly string[] }): readonly string[] =>
  request.sourcePaths.filter((path) => sourceFormOf({ path }) === "shipped");

export const builtModulePath = (request: { readonly path: string }): string =>
  request.path.endsWith(SOURCE_MODULE_EXTENSION)
    ? `${request.path.slice(0, -SOURCE_MODULE_EXTENSION.length)}${BUILT_MODULE_EXTENSION}`
    : request.path;

export const piecePathsIn = (request: { readonly sourcePaths: readonly string[] }): readonly string[] =>
  shippedPaths(request).filter((path) => {
    const match = PIECE_FILE.exec(path);
    return match !== null && match[2] !== RUNNER_FOLDER;
  });

type ParsedPiece = { readonly piece: PieceText; readonly document: unknown; readonly file: PieceFile };

const parsedPieceOf = (request: { readonly piece: PieceText }): Result<ParsedPiece, PlanFailure> => {
  const document = parsedJson({ text: request.piece.text });
  if (document.outcome === "failed") {
    return { outcome: "failed", error: { kind: "piece-invalid", path: request.piece.path, detail: document.error } };
  }
  const parsed = pieceFileSchema.safeParse(document.value);
  return parsed.success
    ? { outcome: "ok", value: { piece: request.piece, document: document.value, file: parsed.data } }
    : { outcome: "failed", error: { kind: "piece-invalid", path: request.piece.path, detail: z.prettifyError(parsed.error) } };
};

const modulesNamedIn = (request: { readonly settings: PieceModuleSettings }): readonly string[] =>
  [request.settings.module, request.settings.pluginModule].flatMap((module) => (module === undefined ? [] : [module]));

const pieceFolderOf = (request: { readonly path: string }): string => request.path.slice(0, request.path.lastIndexOf("/"));

const pieceModuleEntries = (request: ParsedPiece): readonly string[] =>
  request.file.clauses.flatMap((clause) =>
    modulesNamedIn({ settings: clause.settings }).map((module) => `${pieceFolderOf({ path: request.piece.path })}/${module}`),
  );

const builtValueOf = (request: { readonly key: string; readonly value: unknown }): unknown => {
  if (typeof request.value === "string") {
    return PIECE_MODULE_KEYS.has(request.key) ? builtModulePath({ path: request.value }) : request.value;
  }
  if (Array.isArray(request.value)) {
    return request.value.map((value: unknown) => builtValueOf({ key: "", value }));
  }
  if (typeof request.value === "object" && request.value !== null) {
    return Object.fromEntries(Object.entries(request.value).map(([key, value]) => [key, builtValueOf({ key, value })]));
  }
  return request.value;
};

const builtPieceText = (request: { readonly document: unknown }): string =>
  `${JSON.stringify(builtValueOf({ key: "", value: request.document }), null, 2)}\n`;

const parsedPieces = (request: { readonly pieces: readonly PieceText[] }): Result<readonly ParsedPiece[], PlanFailure> =>
  request.pieces.reduce<Result<readonly ParsedPiece[], PlanFailure>>((sofar, piece) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const parsed = parsedPieceOf({ piece });
    return parsed.outcome === "failed" ? parsed : { outcome: "ok", value: [...sofar.value, parsed.value] };
  }, { outcome: "ok", value: [] });

const copiedPathsIn = (request: { readonly sourcePaths: readonly string[] }): readonly string[] =>
  shippedPaths(request).filter((path) => SHIPPED_DOCUMENTS.has(path) || SHIPPED_DATA.some((pattern) => pattern.test(path)));

export const packagePlanOf = (request: {
  readonly sourcePaths: readonly string[];
  readonly pieces: readonly PieceText[];
}): Result<PackagePlan, PlanFailure> => {
  const pieces = parsedPieces({ pieces: request.pieces });
  if (pieces.outcome === "failed") {
    return pieces;
  }
  const runners = shippedPaths(request).filter((path) => RUNNER_ENTRY.test(path));
  const pieceModules = pieces.value.flatMap(pieceModuleEntries);
  return {
    outcome: "ok",
    value: {
      entryPoints: [...new Set([COMMAND_SOURCES.check, COMMAND_SOURCES.project, ...runners, ...pieceModules])],
      commands: {
        check: builtModulePath({ path: COMMAND_SOURCES.check }),
        project: builtModulePath({ path: COMMAND_SOURCES.project }),
      },
      copied: copiedPathsIn(request),
      pieces: pieces.value.map(({ piece, document }) => ({ path: piece.path, text: builtPieceText({ document }) })),
    },
  };
};

export const externalPeersOf = (request: { readonly peers: readonly string[] }): readonly string[] =>
  request.peers.flatMap((peer) => [peer, `${peer}/*`]);

const nameOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const noticeSection = (request: { readonly bundled: BundledPackage }): string =>
  [
    `## ${request.bundled.name} ${request.bundled.version}`,
    "",
    `License: ${request.bundled.license}`,
    "",
    "```text",
    request.bundled.licenseText.trimEnd(),
    "```",
    ...(request.bundled.noticeText === undefined ? [] : ["", "NOTICE:", "", "```text", request.bundled.noticeText.trimEnd(), "```"]),
  ].join("\n");

export const thirdPartyNoticesOf = (request: { readonly packages: readonly BundledPackage[] }): string =>
  `${[
    "# Third-party notices",
    "",
    "This package bundles the following packages into its JavaScript: esbuild combined and re-emitted their code, without changing what it does. Each is redistributed under its own licence, reproduced below.",
    ...[...request.packages]
      .sort((left, right) => nameOrder({ left: left.name, right: right.name }))
      .flatMap((bundled) => ["", noticeSection({ bundled })]),
  ].join("\n")}\n`;
