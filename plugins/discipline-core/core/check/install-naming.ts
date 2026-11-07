import { importsIn } from "./piece-import-rules.ts";

export type NamingScope = {
  readonly mechanisms: readonly string[];
  readonly disciplines: readonly string[];
  readonly coreFiles: readonly string[];
  readonly runnerFiles: readonly string[];
};

export type FileNaming = { readonly file: string; readonly named: readonly string[] };

export type FileReach = { readonly file: string; readonly specifiers: readonly string[] };

export type InstallNamingFindings = {
  readonly scope: NamingScope;
  readonly coreNaming: readonly FileNaming[];
  readonly runnerNaming: readonly FileNaming[];
  readonly coreReach: readonly FileReach[];
};

const folderNamesUnder = (request: {
  readonly trackedPaths: readonly string[];
  readonly folder: string;
}): readonly string[] => [
  ...new Set(
    request.trackedPaths
      .filter((file) => file.startsWith(request.folder))
      .map((file) => file.slice(request.folder.length).split("/"))
      .filter((segments) => segments.length > 1)
      .map((segments) => segments[0]),
  ),
];

const sourceFilesUnder = (request: {
  readonly trackedPaths: readonly string[];
  readonly folders: readonly string[];
}): readonly string[] =>
  request.trackedPaths.filter(
    (file) => request.folders.some((folder) => file.startsWith(folder)) && !file.endsWith(".test.ts"),
  );

export const namingScopeOf = (request: {
  readonly trackedPaths: readonly string[];
  readonly installRoot: string;
}): NamingScope => {
  const mechanismsFolder = `${request.installRoot}/mechanisms/`;
  const mechanisms = folderNamesUnder({ trackedPaths: request.trackedPaths, folder: mechanismsFolder });
  const runnerFolders = mechanisms.map((mechanism) => `${mechanismsFolder}${mechanism}/runner/`);
  const coreFolder = `${request.installRoot}/core/`;
  return {
    mechanisms,
    disciplines: folderNamesUnder({ trackedPaths: request.trackedPaths, folder: `${request.installRoot}/rules/` }),
    coreFiles: sourceFilesUnder({ trackedPaths: request.trackedPaths, folders: [coreFolder] }),
    runnerFiles: sourceFilesUnder({ trackedPaths: request.trackedPaths, folders: runnerFolders }),
  };
};

export const identifiersNamedIn = (request: {
  readonly text: string;
  readonly identifiers: readonly string[];
}): readonly string[] => {
  const tokens = new Set(request.text.match(/[A-Za-z0-9_-]+/g));
  return [...new Set(request.identifiers.filter((identifier) => tokens.has(identifier)))];
};

export const reachingSpecifiersIn = (request: { readonly text: string }): readonly string[] =>
  importsIn({ text: request.text })
    .map((moduleImport) => moduleImport.specifier)
    .filter((specifier) => /(?:^|\/)(?:mechanisms|rules)\//.test(specifier));

const namingIn = (request: {
  readonly files: readonly string[];
  readonly sources: Readonly<Record<string, string>>;
  readonly identifiers: readonly string[];
}): readonly FileNaming[] =>
  Object.entries(request.sources)
    .filter(([file]) => request.files.includes(file))
    .map(([file, text]) => ({ file, named: identifiersNamedIn({ text, identifiers: request.identifiers }) }))
    .filter((naming) => naming.named.length > 0);

const reachIn = (request: {
  readonly files: readonly string[];
  readonly sources: Readonly<Record<string, string>>;
}): readonly FileReach[] =>
  Object.entries(request.sources)
    .filter(([file]) => request.files.includes(file))
    .map(([file, text]) => ({ file, specifiers: reachingSpecifiersIn({ text }) }))
    .filter((reach) => reach.specifiers.length > 0);

export const installNamingFindings = (request: {
  readonly installRoot: string;
  readonly sources: Readonly<Record<string, string>>;
  readonly disciplineFiles: Readonly<Record<string, string>>;
}): InstallNamingFindings => {
  const scope = namingScopeOf({
    trackedPaths: [...Object.keys(request.sources), ...Object.keys(request.disciplineFiles)],
    installRoot: request.installRoot,
  });
  return {
    scope,
    coreNaming: namingIn({
      files: scope.coreFiles,
      sources: request.sources,
      identifiers: [...scope.mechanisms, ...scope.disciplines],
    }),
    runnerNaming: namingIn({ files: scope.runnerFiles, sources: request.sources, identifiers: scope.disciplines }),
    coreReach: reachIn({ files: scope.coreFiles, sources: request.sources }),
  };
};
