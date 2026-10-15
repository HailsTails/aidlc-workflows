import { pieceTypePackagesSchema } from "../mechanism-port/piece-type-packages-schema.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { parsedJson } from "../rule-set-reader/rule-set-reader.ts";
import type { Result } from "../values/result.ts";

export type PieceLocation = {
  readonly file: string;
  readonly ruleSetRoot: string;
  readonly mechanism: string;
  readonly discipline: string;
};

export type PieceImportRefusal = {
  readonly specifier: string;
  readonly reason: "outside-piece-reach" | "value-import-of-package" | "package-not-listed" | "dynamic-import";
};

export type FileImportRefusal = PieceImportRefusal & { readonly file: string };

export type PieceImportFindings = {
  readonly pieces: readonly PieceLocation[];
  readonly refusals: readonly FileImportRefusal[];
};

export type PieceImportFindingsFailure =
  | { readonly kind: "type-packages-missing"; readonly path: string }
  | { readonly kind: "type-packages-malformed"; readonly path: string; readonly detail: string };

export type ImportForm = "type-only" | "value" | "dynamic";

export type ModuleImport = { readonly specifier: string; readonly form: ImportForm };

const IMPORT_STATEMENT = /^\s*(?:import|export)\s+(type\s+)?(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/gm;

const DYNAMIC_IMPORT = /\bimport\s*\(\s*([^)]*?)\s*\)/g;

const QUOTED = /^(["'])(.*)\1$/;

type PlacedImport = ModuleImport & { readonly position: number };

export const importsIn = (request: { readonly text: string }): readonly ModuleImport[] =>
  [
    ...[...request.text.matchAll(IMPORT_STATEMENT)].map(
      (match): PlacedImport => ({
        specifier: match[2],
        form: match[1] === undefined ? "value" : "type-only",
        position: match.index,
      }),
    ),
    ...[...request.text.matchAll(DYNAMIC_IMPORT)].map(
      (match): PlacedImport => ({
        specifier: match[1].replace(QUOTED, "$2"),
        form: "dynamic",
        position: match.index,
      }),
    ),
  ]
    .toSorted((first, second) => first.position - second.position)
    .map((placed) => ({ specifier: placed.specifier, form: placed.form }));

const normalisedOf = (request: { readonly text: string }): string =>
  request.text === "." ? "" : request.text.replace(/^(?:\.\/)+/, "");

const folderPrefixOf = (request: { readonly root: string }): string => {
  const root = normalisedOf({ text: request.root });
  return root === "" ? "" : `${root}/`;
};

const pieceLocationOf = (request: {
  readonly file: string;
  readonly ruleSetRoot: string;
}): readonly PieceLocation[] => {
  const prefix = `${folderPrefixOf({ root: request.ruleSetRoot })}mechanisms/`;
  const file = normalisedOf({ text: request.file });
  if (!file.startsWith(prefix) || file.endsWith(".test.ts") || !file.endsWith(".ts")) {
    return [];
  }
  const [mechanism, discipline, ...rest] = file.slice(prefix.length).split("/");
  return discipline === undefined || discipline === "runner" || rest.length === 0
    ? []
    : [{ file: request.file, ruleSetRoot: request.ruleSetRoot, mechanism, discipline }];
};

export const pieceFilesOf = (request: {
  readonly trackedPaths: readonly string[];
  readonly ruleSetRoots: readonly string[];
}): readonly PieceLocation[] =>
  request.trackedPaths.flatMap(
    (file) =>
      request.ruleSetRoots
        .map((ruleSetRoot) => pieceLocationOf({ file, ruleSetRoot }))
        .find((locations) => locations.length > 0) ?? [],
  );

const specifierKindOf = (request: { readonly specifier: string }): "relative" | "package" =>
  request.specifier.startsWith("./") || request.specifier.startsWith("../") ? "relative" : "package";

const relativeRefusal = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly piece: PieceLocation;
  readonly specifier: string;
}): readonly PieceImportRefusal[] => {
  const target = request.path.join({
    segments: [request.path.directoryOf({ path: request.piece.file }), request.specifier],
  });
  const reach = [
    [request.piece.ruleSetRoot, "mechanisms", request.piece.mechanism, request.piece.discipline],
    [request.piece.ruleSetRoot, "rules", request.piece.discipline],
    [request.installRoot, "mechanisms", request.piece.mechanism, "runner"],
    [request.installRoot, "core"],
  ].map((segments) => `${request.path.join({ segments })}/`);
  return reach.some((folder) => target.startsWith(folder))
    ? []
    : [{ specifier: request.specifier, reason: "outside-piece-reach" }];
};

const packageRefusal = (request: {
  readonly moduleImport: ModuleImport;
  readonly typePackages: readonly string[];
}): readonly PieceImportRefusal[] => {
  if (request.moduleImport.form === "value") {
    return [{ specifier: request.moduleImport.specifier, reason: "value-import-of-package" }];
  }
  return request.typePackages.includes(request.moduleImport.specifier)
    ? []
    : [{ specifier: request.moduleImport.specifier, reason: "package-not-listed" }];
};

const dynamicRefusal = (request: { readonly specifier: string }): readonly PieceImportRefusal[] => [
  { specifier: request.specifier, reason: "dynamic-import" },
];

export const pieceImportRefusals = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly piece: PieceLocation;
  readonly source: string;
  readonly typePackages: readonly string[];
}): readonly PieceImportRefusal[] =>
  importsIn({ text: request.source }).flatMap((moduleImport) =>
    moduleImport.form === "dynamic"
      ? dynamicRefusal({ specifier: moduleImport.specifier })
      : specifierKindOf({ specifier: moduleImport.specifier }) === "relative"
      ? relativeRefusal({
          path: request.path,
          installRoot: request.installRoot,
          piece: request.piece,
          specifier: moduleImport.specifier,
        })
      : packageRefusal({ moduleImport, typePackages: request.typePackages }),
  );

type TypePackagesByMechanism = Readonly<Record<string, readonly string[]>>;

const typePackagesOf = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly mechanism: string;
  readonly typePackageTexts: Readonly<Record<string, string>>;
}): Result<readonly string[], PieceImportFindingsFailure> => {
  const listPath = request.path.join({
    segments: [request.installRoot, "mechanisms", request.mechanism, "runner", "piece-type-packages.json"],
  });
  const text = Object.entries(request.typePackageTexts).find(
    ([key]) => request.path.join({ segments: [key] }) === listPath,
  );
  if (text === undefined) {
    return { outcome: "failed", error: { kind: "type-packages-missing", path: listPath } };
  }
  const json = parsedJson({ text: text[1] });
  if (json.outcome === "failed") {
    return { outcome: "failed", error: { kind: "type-packages-malformed", path: listPath, detail: json.error } };
  }
  const parsed = pieceTypePackagesSchema.safeParse(json.value);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : { outcome: "failed", error: { kind: "type-packages-malformed", path: listPath, detail: parsed.error.message } };
};

export const pieceImportFindings = (request: {
  readonly path: PathPort;
  readonly installRoot: string;
  readonly ruleSetRoots: readonly string[];
  readonly sources: Readonly<Record<string, string>>;
  readonly typePackageTexts: Readonly<Record<string, string>>;
}): Result<PieceImportFindings, PieceImportFindingsFailure> => {
  const pieces = pieceFilesOf({ trackedPaths: Object.keys(request.sources), ruleSetRoots: request.ruleSetRoots });
  const packages = [...new Set(pieces.map((piece) => piece.mechanism))].reduce<
    Result<TypePackagesByMechanism, PieceImportFindingsFailure>
  >((collected, mechanism) => {
    if (collected.outcome === "failed") {
      return collected;
    }
    const listed = typePackagesOf({
      path: request.path,
      installRoot: request.installRoot,
      mechanism,
      typePackageTexts: request.typePackageTexts,
    });
    return listed.outcome === "failed"
      ? listed
      : { outcome: "ok", value: { ...collected.value, [mechanism]: listed.value } };
  }, { outcome: "ok", value: {} });
  if (packages.outcome === "failed") {
    return packages;
  }
  return {
    outcome: "ok",
    value: {
      pieces,
      refusals: Object.entries(request.sources).flatMap(([file, source]) =>
        pieces
          .filter((piece) => piece.file === file)
          .flatMap((piece) =>
            pieceImportRefusals({
              path: request.path,
              installRoot: request.installRoot,
              piece,
              source,
              typePackages: packages.value[piece.mechanism],
            }).map((refusal) => ({ file, ...refusal })),
          ),
      ),
    },
  };
};
