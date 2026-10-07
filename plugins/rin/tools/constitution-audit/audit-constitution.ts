import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { exportSurfaceOf } from "./export-surface.js";
import { walkSourceFiles } from "./walk-source-files.js";

type ConstitutionViolation = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

type ServiceAuditConfig = {
  readonly name: string;
  readonly srcRoot: string;
  readonly scriptsRoot: string;
  readonly uiSrcRoot: string;
};

type AuditConstitutionArgs = {
  readonly service: ServiceAuditConfig;
};

type AuditConstitutionReport = {
  readonly service: ServiceAuditConfig;
  readonly violations: readonly ConstitutionViolation[];
  readonly scannedFiles: readonly string[];
};

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

const BANNED_THIRD_PARTY_IMPORTS: readonly string[] = [
  "winston",
  "winston-transport",
  "better-sqlite3",
  "pino",
  "hono",
  "@hono/node-server",
  "hono/cors",
  "hono/cookie",
  "hono/types",
  "hono/utils/http-status",
  "jose",
  "@modelcontextprotocol/sdk",
  "zod-to-json-schema",
  "uuid",
];

const SELF_AUDIT_EXCLUDED_FILENAMES: readonly string[] = [
  "audit-constitution.ts",
];

type SelfAuditExemption = "self-exempt" | "not-self-exempt";

const selfAuditExemptionOf = ({
  filePath,
}: {
  readonly filePath: string;
}): SelfAuditExemption =>
  SELF_AUDIT_EXCLUDED_FILENAMES.includes(basename(filePath))
    ? "self-exempt"
    : "not-self-exempt";

const TEST_FILE_SUFFIX = ".test.ts";
const TEST_TSX_FILE_SUFFIX = ".test.tsx";
const INTEGRATION_TEST_FILE_SUFFIX = ".integration.test.ts";

const safeIsDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const enumerateSourceFiles = (rootDir: string): readonly string[] => {
  if (!safeIsDir(rootDir)) {
    return [];
  }
  return walkSourceFiles({ rootDir }).filter(
    (filePath) =>
      (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) &&
      !SELF_AUDIT_EXCLUDED_FILENAMES.includes(basename(filePath)),
  );
};

const enumerateTsxFiles = (rootDir: string): readonly string[] => {
  if (!safeIsDir(rootDir)) {
    return [];
  }
  return walkSourceFiles({ rootDir }).filter(
    (filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"),
  );
};

const splitLines = (content: string): readonly string[] => content.split("\n");

const checkCategoricalFilenames = (
  filePath: string,
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
  filePath: string,
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

const checkClassDeclarations = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) =>
      /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w/.test(line),
    )
    .map(({ line, lineNumber }) => ({
      rule: "CD-14",
      file: filePath,
      line: lineNumber,
      snippet: line.trim(),
    }));

const checkBareDateConstruction = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(
      ({ line }) => /\bDate\.now\(\)/.test(line) || /\bnew Date\b/.test(line),
    )
    .map(({ line, lineNumber }) => ({
      rule: "CD-17",
      file: filePath,
      line: lineNumber,
      snippet: line.trim(),
    }));

const checkBannedImports = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .flatMap(({ line, lineNumber }) =>
      BANNED_THIRD_PARTY_IMPORTS.filter((bannedSpecifier) =>
        new RegExp(
          `from\\s+["']${bannedSpecifier.replace(/[/.]/g, "\\$&")}["']`,
        ).test(line),
      ).map(
        (bannedSpecifier): ConstitutionViolation => ({
          rule: "CD-19",
          file: filePath,
          line: lineNumber,
          snippet: `banned third-party import: ${bannedSpecifier} — use the kernel port package`,
        }),
      ),
    );

const checkNodeStdlibImports = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /from\s+["']node:[a-z/]+["']/.test(line))
    .map(({ line, lineNumber }) => ({
      rule: "CD-20",
      file: filePath,
      line: lineNumber,
      snippet: `bare node: stdlib import — use the kernel port package: ${line.trim()}`,
    }));

const checkObjectFromEntries = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /\bObject\.fromEntries\b/.test(line))
    .map(({ line, lineNumber }) => ({
      rule: "Amendment 2.8.0",
      file: filePath,
      line: lineNumber,
      snippet: line.trim(),
    }));

const BARE_TODO_PATTERN = /\/\/\s*TODO\b(?!\s*\()/;

const BARE_BIOME_IGNORE_PATTERN = /\/\/\s*biome-ignore\b(?!.*\(spec-\d+\))/;

const BARE_TS_EXPECT_ERROR_PATTERN =
  /\/\/\s*@ts-expect-error\b(?!.*\(spec-\d+\))/;

const checkBareTodoAnnotation = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => BARE_TODO_PATTERN.test(line))
    .map(({ line, lineNumber }) => ({
      rule: "CD-5 (bare `// TODO` — require `TODO(spec-NNN)` tracker reference)",
      file: filePath,
      line: lineNumber,
      snippet: line.trim(),
    }));

const checkBareBiomeIgnoreAnnotation = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => BARE_BIOME_IGNORE_PATTERN.test(line))
    .map(({ line, lineNumber }) => ({
      rule: "CD-5 (bare `// biome-ignore` — require `(spec-NNN)` tracker reference)",
      file: filePath,
      line: lineNumber,
      snippet: line.trim(),
    }));

const checkBareTsExpectErrorAnnotation = (
  filePath: string,
  content: string,
): readonly ConstitutionViolation[] =>
  splitLines(content)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => BARE_TS_EXPECT_ERROR_PATTERN.test(line))
    .map(({ line, lineNumber }) => ({
      rule: "CD-5 (bare `// @ts-expect-error` — require `(spec-NNN)` tracker reference)",
      file: filePath,
      line: lineNumber,
      snippet: line.trim(),
    }));

const isTypeOnlyFile = (filePath: string): boolean =>
  exportSurfaceOf({
    fileName: filePath,
    sourceText: readFileSync(filePath, "utf-8"),
  }) === "types-only";

const TEST_INFRA_DIR_SEGMENT = "__tests__";

const isInTestInfraDir = (filePath: string): boolean =>
  filePath.split(/[\\/]/).includes(TEST_INFRA_DIR_SEGMENT);

const UI_COMPOSITION_ROOT_FILENAMES: readonly string[] = [
  "App.tsx",
  "main.tsx",
];

const isUiCompositionRoot = (filePath: string): boolean =>
  UI_COMPOSITION_ROOT_FILENAMES.includes(basename(filePath));

const checkTestSiblings = (
  srcFiles: readonly string[],
): readonly ConstitutionViolation[] => {
  const productionFiles = srcFiles.filter(
    (filePath) =>
      !filePath.endsWith(TEST_FILE_SUFFIX) &&
      !filePath.endsWith(TEST_TSX_FILE_SUFFIX) &&
      !filePath.endsWith(INTEGRATION_TEST_FILE_SUFFIX) &&
      !filePath.endsWith(".d.ts"),
  );
  const fileSet = new Set(srcFiles);
  return productionFiles
    .filter(
      (productionFilePath) =>
        !isUiCompositionRoot(productionFilePath) &&
        !isInTestInfraDir(productionFilePath) &&
        !isTypeOnlyFile(productionFilePath),
    )
    .filter((productionFilePath) => {
      const expectedSiblingPath = productionFilePath.endsWith(".tsx")
        ? productionFilePath.replace(/\.tsx$/, ".test.tsx")
        : productionFilePath.replace(/\.ts$/, ".test.ts");
      return !fileSet.has(expectedSiblingPath);
    })
    .map((orphanFile) => ({
      rule: "CD-23/24",
      file: orphanFile,
      line: 0,
      snippet: `missing co-located *.test.ts(x) sibling`,
    }));
};

const auditSrcFile = (filePath: string): readonly ConstitutionViolation[] => {
  const content = readFileSync(filePath, "utf-8");
  const skipBareDateConstruction = isUiCompositionRoot(filePath);
  return [
    ...checkCategoricalFilenames(filePath),
    ...checkCategoricalFolders(filePath),
    ...checkClassDeclarations(filePath, content),
    ...(skipBareDateConstruction
      ? []
      : checkBareDateConstruction(filePath, content)),
    ...checkBannedImports(filePath, content),
    ...checkNodeStdlibImports(filePath, content),
    ...checkObjectFromEntries(filePath, content),
    ...checkBareTodoAnnotation(filePath, content),
    ...checkBareBiomeIgnoreAnnotation(filePath, content),
    ...checkBareTsExpectErrorAnnotation(filePath, content),
  ];
};

const auditScriptFile = (
  filePath: string,
): readonly ConstitutionViolation[] => {
  const content = readFileSync(filePath, "utf-8");
  return [
    ...checkCategoricalFilenames(filePath),
    ...checkCategoricalFolders(filePath),
    ...checkClassDeclarations(filePath, content),
    ...checkObjectFromEntries(filePath, content),
    ...checkBareTodoAnnotation(filePath, content),
    ...checkBareBiomeIgnoreAnnotation(filePath, content),
    ...checkBareTsExpectErrorAnnotation(filePath, content),
  ];
};

const auditConstitution = ({
  service,
}: AuditConstitutionArgs): AuditConstitutionReport => {
  const srcFiles = enumerateSourceFiles(service.srcRoot);
  const scriptFiles = enumerateSourceFiles(service.scriptsRoot);
  const uiFiles = enumerateTsxFiles(service.uiSrcRoot);
  const srcViolations = srcFiles.flatMap(auditSrcFile);
  const scriptViolations = scriptFiles.flatMap(auditScriptFile);
  const uiViolations = uiFiles.flatMap(auditSrcFile);
  const ratioViolations = [
    ...checkTestSiblings(srcFiles),
    ...checkTestSiblings(uiFiles),
  ];
  return {
    service,
    violations: [
      ...srcViolations,
      ...scriptViolations,
      ...uiViolations,
      ...ratioViolations,
    ],
    scannedFiles: [...srcFiles, ...scriptFiles, ...uiFiles],
  };
};

type FormatReportArgs = {
  readonly report: AuditConstitutionReport;
  readonly cwdRelativeFrom: (filePath: string) => string;
  readonly auditLabel?: string;
};

const formatReport = ({
  report,
  cwdRelativeFrom,
  auditLabel = "constitution",
}: FormatReportArgs): string => {
  if (report.violations.length === 0) {
    return [
      `${report.service.name} ${auditLabel} audit: PASS`,
      `- 0 violations across ${report.scannedFiles.length} scanned file(s)`,
    ].join("\n");
  }
  const violationLines = report.violations.map(
    (violation) =>
      `  [${violation.rule}] ${cwdRelativeFrom(violation.file)}${violation.line > 0 ? `:${violation.line}` : ""} — ${violation.snippet}`,
  );
  return [
    `${report.service.name} ${auditLabel} audit: FAIL`,
    `- ${report.violations.length} violation(s) across ${report.scannedFiles.length} scanned file(s)`,
    ...violationLines,
  ].join("\n");
};

export {
  type AuditConstitutionArgs,
  type AuditConstitutionReport,
  auditConstitution,
  type ConstitutionViolation,
  formatReport,
  SELF_AUDIT_EXCLUDED_FILENAMES,
  type SelfAuditExemption,
  type ServiceAuditConfig,
  selfAuditExemptionOf,
};
