import { existsSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./constitution-audit/index.ts";
import { loadHarnessConfig } from "./rin-harness-config.ts";

type ConstitutionScopeConfig = {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly scriptGlobs: readonly string[];
  readonly uiGlobs: readonly string[];
};

const SENTINEL_ABSENT_ROOT = "__aidlc_constitution_absent_root__";

const DEFAULT_SCOPE: ConstitutionScopeConfig = {
  include: ["src/**", "scripts/**", "*.ts", "*.tsx"],
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.aidlc/**",
    "**/aidlc/**",
    "**/.claude/**",
    "**/coverage/**",
    "**/.git/**",
  ],
  scriptGlobs: ["scripts/**"],
  uiGlobs: ["ui/src/**", "src/ui/**"],
};

const orDefault = (
  candidate: readonly string[],
  fallback: readonly string[],
): readonly string[] => (candidate.length > 0 ? candidate : fallback);

const readScopeBlock = ({
  projectDir,
}: {
  readonly projectDir: string;
}): ConstitutionScopeConfig => {
  const block = loadHarnessConfig({ projectDir }).constitution;
  if (block === undefined) {
    return DEFAULT_SCOPE;
  }
  return {
    include: orDefault(block.include, DEFAULT_SCOPE.include),
    exclude: orDefault(block.exclude, DEFAULT_SCOPE.exclude),
    scriptGlobs: orDefault(block.scriptGlobs, DEFAULT_SCOPE.scriptGlobs),
    uiGlobs: orDefault(block.uiGlobs, DEFAULT_SCOPE.uiGlobs),
  };
};

const GLOBSTAR_SLASH_TOKEN = "\u0000gss\u0000";
const GLOBSTAR_TOKEN = "\u0000gs\u0000";
const STAR_TOKEN = "\u0000s\u0000";
const QUESTION_TOKEN = "\u0000q\u0000";

const globToRegexSource = (glob: string): string => {
  const marked = glob
    .replaceAll("**/", GLOBSTAR_SLASH_TOKEN)
    .replaceAll("**", GLOBSTAR_TOKEN)
    .replaceAll("*", STAR_TOKEN)
    .replaceAll("?", QUESTION_TOKEN);
  const escaped = marked.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return escaped
    .replaceAll(GLOBSTAR_SLASH_TOKEN, "(?:[^/]+/)*")
    .replaceAll(GLOBSTAR_TOKEN, ".*")
    .replaceAll(STAR_TOKEN, "[^/]*")
    .replaceAll(QUESTION_TOKEN, "[^/]");
};

const globToRegex = (glob: string): RegExp =>
  new RegExp(`^${globToRegexSource(glob)}$`);

const normalizeRelative = (path: string): string => path.replace(/\\/g, "/");

const relativeFromRoot = ({
  filePath,
  projectDir,
}: {
  readonly filePath: string;
  readonly projectDir: string;
}): string =>
  normalizeRelative(
    relative(
      projectDir,
      isAbsolute(filePath) ? filePath : resolve(projectDir, filePath),
    ),
  );

const matchesAnyGlob = ({
  relPath,
  globs,
}: {
  readonly relPath: string;
  readonly globs: readonly string[];
}): boolean => globs.some((glob) => globToRegex(glob).test(relPath));

const isSourceLike = (relPath: string): boolean =>
  relPath.endsWith(".ts") || relPath.endsWith(".tsx");

const resolveConstitutionScope = ({
  projectDir,
}: {
  readonly projectDir: string;
}): ConstitutionScopeConfig => readScopeBlock({ projectDir });

const isInScope = ({
  filePath,
  projectDir,
  scope,
}: {
  readonly filePath: string;
  readonly projectDir: string;
  readonly scope: ConstitutionScopeConfig;
}): boolean => {
  const relPath = relativeFromRoot({ filePath, projectDir });
  if (relPath.startsWith("..")) return false;
  if (!isSourceLike(relPath)) return false;
  if (!matchesAnyGlob({ relPath, globs: scope.include })) return false;
  return !matchesAnyGlob({ relPath, globs: scope.exclude });
};

const filePathIsInScope = ({
  filePath,
  projectDir,
}: {
  readonly filePath: string;
  readonly projectDir: string;
}): boolean =>
  isInScope({
    filePath,
    projectDir,
    scope: resolveConstitutionScope({ projectDir }),
  });

const safeIsDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const wholeProjectService = ({
  projectDir,
}: {
  readonly projectDir: string;
}): ServiceAuditConfig => ({
  name: basename(projectDir),
  srcRoot: projectDir,
  scriptsRoot: safeIsDir(join(projectDir, "scripts"))
    ? join(projectDir, "scripts")
    : join(projectDir, SENTINEL_ABSENT_ROOT),
  uiSrcRoot: join(projectDir, SENTINEL_ABSENT_ROOT),
});

const SCRIPT_RULE_PREFIXES: readonly string[] = [
  "CD-5",
  "CD-7",
  "CD-7a",
  "CD-8",
  "CD-14",
  "CD-15",
  "CD-16",
  "CD-19",
  "Amendment 2.8.0",
];

const isScriptPath = ({
  filePath,
  projectDir,
  scope,
}: {
  readonly filePath: string;
  readonly projectDir: string;
  readonly scope: ConstitutionScopeConfig;
}): boolean =>
  matchesAnyGlob({
    relPath: relativeFromRoot({ filePath, projectDir }),
    globs: scope.scriptGlobs,
  });

const ruleSurvivesScriptRelaxation = ({
  filePath,
  rule,
  projectDir,
  scope,
}: {
  readonly filePath: string;
  readonly rule: string;
  readonly projectDir: string;
  readonly scope: ConstitutionScopeConfig;
}): boolean => {
  if (!isScriptPath({ filePath, projectDir, scope })) {
    return true;
  }
  return SCRIPT_RULE_PREFIXES.some((prefix) => rule.startsWith(prefix));
};

const violationSurvivesScriptRelaxation = ({
  violation,
  projectDir,
  scope,
}: {
  readonly violation: ConstitutionViolation;
  readonly projectDir: string;
  readonly scope: ConstitutionScopeConfig;
}): boolean =>
  ruleSurvivesScriptRelaxation({
    filePath: violation.file,
    rule: violation.rule,
    projectDir,
    scope,
  });

const filterReportToScope = ({
  report,
  projectDir,
  scope,
}: {
  readonly report: AuditConstitutionReport;
  readonly projectDir: string;
  readonly scope: ConstitutionScopeConfig;
}): AuditConstitutionReport => {
  const keep = (filePath: string): boolean =>
    isInScope({ filePath, projectDir, scope });
  const violations: readonly ConstitutionViolation[] = report.violations.filter(
    (violation) =>
      keep(violation.file) &&
      violationSurvivesScriptRelaxation({ violation, projectDir, scope }),
  );
  const scannedFiles: readonly string[] = report.scannedFiles.filter(keep);
  return { service: report.service, violations, scannedFiles };
};

const existsAsFile = (path: string): boolean => {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
};

export type { ConstitutionScopeConfig };
export {
  DEFAULT_SCOPE,
  existsAsFile,
  filePathIsInScope,
  filterReportToScope,
  globToRegex,
  isInScope,
  isSourceLike,
  matchesAnyGlob,
  relativeFromRoot,
  resolveConstitutionScope,
  ruleSurvivesScriptRelaxation,
  SENTINEL_ABSENT_ROOT,
  wholeProjectService,
};
