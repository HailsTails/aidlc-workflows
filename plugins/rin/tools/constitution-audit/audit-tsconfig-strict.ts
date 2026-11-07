import { readFileSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";
import { walkSourceFiles } from "./walk-source-files.js";

type AuditTsconfigStrictArgs = {
  readonly service: ServiceAuditConfig;
};

const TSCONFIG_FILENAME = "tsconfig.json";

const STRICT_FLAG_NAMES: readonly string[] = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "noImplicitOverride",
  "noFallthroughCasesInSwitch",
  "noPropertyAccessFromIndexSignature",
  "useUnknownInCatchVariables",
];

const fileExists = (filePath: string): boolean => {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const walkTsconfigFiles = (rootDir: string): readonly string[] =>
  walkSourceFiles({ rootDir }).filter(
    (filePath) => basename(filePath) === TSCONFIG_FILENAME,
  );

type TsconfigShape = {
  readonly compilerOptions?: Record<string, unknown>;
};

const parseTsconfig = (filePath: string): TsconfigShape | undefined => {
  try {
    const text = readFileSync(filePath, "utf-8");
    const parsed = parseJsonc(text);
    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }
    return parsed as TsconfigShape;
  } catch {
    return undefined;
  }
};

const violationsForTsconfig = (
  filePath: string,
): readonly ConstitutionViolation[] => {
  const parsed = parseTsconfig(filePath);
  if (parsed === undefined) {
    return [];
  }
  const compilerOptions = parsed.compilerOptions;
  if (compilerOptions === undefined) {
    return [];
  }
  return STRICT_FLAG_NAMES.flatMap((flagName) => {
    if (!(flagName in compilerOptions)) {
      return [];
    }
    return [
      {
        rule: `CD-3 (strict-mode flag \`${flagName}\` overridden in package tsconfig — strict flags are inherited from tsconfig.base.json and never overridden)`,
        file: filePath,
        line: 0,
        snippet: `compilerOptions.${flagName} = ${JSON.stringify(compilerOptions[flagName])}`,
      },
    ];
  });
};

const auditTsconfigStrict = ({
  service,
}: AuditTsconfigStrictArgs): AuditConstitutionReport => {
  const serviceRoot = dirname(service.srcRoot);
  const candidateTsconfigs = walkTsconfigFiles(serviceRoot).filter(fileExists);
  const violations = candidateTsconfigs.flatMap(violationsForTsconfig);
  return { service, scannedFiles: candidateTsconfigs, violations };
};

export { type AuditTsconfigStrictArgs, auditTsconfigStrict };
