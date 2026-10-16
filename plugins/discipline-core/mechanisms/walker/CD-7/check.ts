import type { RepoPath } from "../../../core/values/repo-path.ts";
import { sourceCandidates } from "../runner/legacy-source.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

type ConstitutionViolation = {
  readonly rule: string;
  readonly file: RepoPath;
  readonly line: number;
  readonly snippet: string;
};

const basename = (file: string): string => file.split(/[\\/]/).at(-1) ?? file;
const located = (finding: ConstitutionViolation): LocatedSnippet => ({
  file: finding.file,
  anchor: { line: Math.max(1, finding.line), column: 0 },
  snippet: finding.snippet,
});

const FORBIDDEN_FILENAMES: readonly string[] = [
  "types.ts",
  "interfaces.ts",
  "models.ts",
  "enums.ts",
  "utils.ts",
  "util.ts",
  "helpers.ts",
  "helper.ts",
  "common.ts",
  "lib.ts",
  "misc.ts",
  "shared.ts",
];

const FORBIDDEN_FOLDERS: readonly string[] = [
  "utils",
  "helpers",
  "common",
  "lib",
  "misc",
  "shared",
];

const checkCategoricalFilenames = (
  filePath: RepoPath,
): readonly ConstitutionViolation[] => {
  const fileName = basename(filePath);
  if (!FORBIDDEN_FILENAMES.includes(fileName)) {
    return [];
  }
  return [
    {
      rule: "CD-7",
      file: filePath,
      line: 0,
      snippet: `forbidden categorical filename: ${fileName}`,
    },
  ];
};

const checkCategoricalFolders = (
  filePath: RepoPath,
): readonly ConstitutionViolation[] => {
  const segments = filePath.split(/[\\/]/);
  const matchedSegment = segments.find((segment) =>
    FORBIDDEN_FOLDERS.includes(segment),
  );
  if (matchedSegment === undefined) {
    return [];
  }
  return [
    {
      rule: "CD-7",
      file: filePath,
      line: 0,
      snippet: `forbidden categorical folder: ${matchedSegment}`,
    },
  ];
};

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => ({
    outcome: "ok",
    value: sourceCandidates({ repository })
      .filter((file) => basename(file) !== "audit-constitution.ts")
      .flatMap((file) => [...checkCategoricalFilenames(file), ...checkCategoricalFolders(file)].map(located)),
  }),
};
