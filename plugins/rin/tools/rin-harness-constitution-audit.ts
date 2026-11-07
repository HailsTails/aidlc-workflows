import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walkSourceFiles } from "./constitution-audit/index.ts";
import {
  CD_ENFORCEMENT,
  cdSensorPassOf,
  runCdSensorProjectMode,
} from "./rin-harness-cd-enforcement.ts";
import {
  isInScope,
  resolveConstitutionScope,
} from "./rin-harness-constitution-scope.ts";

const CARVE_OUT_DIR = ".constitution-carve-outs/";

const HOOK_VIOLATIONS_COUNT_KEY = "violations_count";
const HOOK_SCANNED_COUNT_KEY = "scanned_count";
const HOOK_STALE_AUTHORISATIONS_KEY = "stale_authorisations";
const HOOK_STALE_CARVE_OUTS_KEY = "stale_carve_outs";
const HOOK_DOUBLY_HELD_KEY = "doubly_held";
const HOOK_BY_RULE_KEY = "by_rule";
const HOOK_BY_FILE_KEY = "by_file";

const RULE_ID_COLUMN_WIDTH = 10;
const COUNT_COLUMN_WIDTH = 4;

type Flags = {
  readonly projectDir: string;
  readonly json: boolean;
};

type AuditViolation = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

type ExemptionDefect = {
  readonly cdId: string;
  readonly file: string;
};

type AuditOutcome = {
  readonly pass: boolean;
  readonly violationsCount: number;
  readonly scannedCount: number;
  readonly violations: readonly AuditViolation[];
  readonly staleAuthorisations: readonly ExemptionDefect[];
  readonly staleCarveOuts: readonly ExemptionDefect[];
  readonly doublyHeld: readonly ExemptionDefect[];
  readonly humanReport: string;
};

const parseFlags = (argv: readonly string[]): Flags => {
  const findValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    projectDir: resolve(findValue("--project-dir") ?? process.cwd()),
    json: argv.includes("--json"),
  };
};

type CdOutcome = {
  readonly cdId: string;
  readonly pass: boolean;
  readonly violations: readonly AuditViolation[];
  readonly staleAuthorisedPaths: readonly string[];
  readonly staleCarvedPaths: readonly string[];
  readonly doublyHeldPaths: readonly string[];
};

const formatExemptionDefectLines = (outcome: CdOutcome): readonly string[] => [
  ...outcome.staleAuthorisedPaths.map(
    (file) =>
      `  [stale authorised-location] ${outcome.cdId} ${file} — suppresses nothing; delete this entry`,
  ),
  ...outcome.staleCarvedPaths.map(
    (file) =>
      `  [stale carve-out] ${outcome.cdId} ${file} — suppresses nothing; pay down or delete the entry`,
  ),
  ...outcome.doublyHeldPaths.map(
    (file) =>
      `  [doubly-held] ${outcome.cdId} ${file} — held as both carve-out and authorised-location; resolve to exactly one instrument`,
  ),
];

const formatCdSection = (outcome: CdOutcome): string => {
  const exemptionDefectLines = formatExemptionDefectLines(outcome);
  if (outcome.violations.length === 0) {
    return [
      `${outcome.cdId} audit: PASS — 0 violations`,
      ...exemptionDefectLines,
    ].join("\n");
  }
  const violationLines = outcome.violations.map(
    (violation) =>
      `  [${violation.rule}] ${violation.file}${violation.line > 0 ? `:${violation.line}` : ""} — ${violation.snippet}`,
  );
  return [
    `${outcome.cdId} audit: FAIL — ${outcome.violations.length} violation(s)`,
    ...violationLines,
    ...exemptionDefectLines,
  ].join("\n");
};

const exemptionDefectsOf = ({
  outcomes,
  pathsOf,
}: {
  readonly outcomes: readonly CdOutcome[];
  readonly pathsOf: (outcome: CdOutcome) => readonly string[];
}): readonly ExemptionDefect[] =>
  outcomes.flatMap((outcome) =>
    pathsOf(outcome).map((file) => ({ cdId: outcome.cdId, file })),
  );

const syntheticViolationsOf = ({
  defects,
  ruleSuffix,
  snippet,
}: {
  readonly defects: readonly ExemptionDefect[];
  readonly ruleSuffix: string;
  readonly snippet: string;
}): readonly AuditViolation[] =>
  defects.map((defect) => ({
    rule: `${defect.cdId} (${ruleSuffix})`,
    file: defect.file,
    line: 0,
    snippet,
  }));

const cdIdOf = (rule: string): string => rule.split(" ")[0] ?? rule;

const countBy = <TKey>({
  items,
  keyOf,
}: {
  readonly items: readonly AuditViolation[];
  readonly keyOf: (violation: AuditViolation) => TKey;
}): ReadonlyMap<TKey, number> =>
  items.reduce((tally, violation) => {
    const key = keyOf(violation);
    return new Map(tally).set(key, (tally.get(key) ?? 0) + 1);
  }, new Map<TKey, number>());

const descendingByCount = <TKey>(
  tally: ReadonlyMap<TKey, number>,
): readonly (readonly [TKey, number])[] =>
  [...tally.entries()].sort(
    ([leftKey, leftCount], [rightKey, rightCount]) =>
      rightCount - leftCount || String(leftKey).localeCompare(String(rightKey)),
  );

const SUMMARY_FILE_LIMIT = 10;

const filesPerRuleOf = (
  violations: readonly AuditViolation[],
): ReadonlyMap<string, ReadonlySet<string>> =>
  violations.reduce((grouped, violation) => {
    const cdId = cdIdOf(violation.rule);
    return new Map(grouped).set(
      cdId,
      new Set(grouped.get(cdId)).add(violation.file),
    );
  }, new Map<string, ReadonlySet<string>>());

const ruleLinesOf = (
  violations: readonly AuditViolation[],
): readonly string[] => {
  const filesPerRule = filesPerRuleOf(violations);
  return descendingByCount(
    countBy({ items: violations, keyOf: (v) => cdIdOf(v.rule) }),
  ).map(
    ([cdId, count]) =>
      `  ${cdId.padEnd(RULE_ID_COLUMN_WIDTH)} ${String(count).padStart(COUNT_COLUMN_WIDTH)} across ${filesPerRule.get(cdId)?.size ?? 0} file(s)`,
  );
};

const worstFileLinesOf = (
  byFile: readonly (readonly [string, number])[],
): readonly string[] =>
  byFile
    .slice(0, SUMMARY_FILE_LIMIT)
    .map(
      ([file, count]) =>
        `  ${String(count).padStart(COUNT_COLUMN_WIDTH)}  ${file}`,
    );

const formatSummary = ({
  violations,
  scannedCount,
}: {
  readonly violations: readonly AuditViolation[];
  readonly scannedCount: number;
}): string => {
  if (violations.length === 0) return "";
  const byFile = descendingByCount(
    countBy({ items: violations, keyOf: (violation) => violation.file }),
  );
  const fileLines = worstFileLinesOf(byFile);
  const remainder = byFile.length - fileLines.length;
  return [
    "",
    "═══ SUMMARY ═══",
    `${violations.length} violation(s) across ${byFile.length} file(s) of ${scannedCount} scanned.`,
    "",
    "By rule:",
    ...ruleLinesOf(violations),
    "",
    `Worst files${remainder > 0 ? ` (top ${SUMMARY_FILE_LIMIT} of ${byFile.length})` : ""}:`,
    ...fileLines,
    ...(remainder > 0 ? [`  … and ${remainder} more file(s)`] : []),
  ].join("\n");
};

const cdOutcomesOf = ({
  projectDir,
}: {
  readonly projectDir: string;
}): readonly CdOutcome[] =>
  CD_ENFORCEMENT.map((entry) => {
    const result = runCdSensorProjectMode({ cdId: entry.cdId, projectDir });
    return {
      cdId: entry.cdId,
      pass: cdSensorPassOf({ sensorResult: result }),
      violations: result.violations.map((violation) => ({
        rule: violation.rule,
        file: violation.file,
        line: violation.line,
        snippet: violation.snippet,
      })),
      staleAuthorisedPaths: result.staleAuthorisedPaths,
      staleCarvedPaths: result.staleCarvedPaths,
      doublyHeldPaths: result.doublyHeldPaths,
    };
  });

const runAudit = (flags: Flags): AuditOutcome => {
  const outcomes = cdOutcomesOf({ projectDir: flags.projectDir });
  const walkerViolations: readonly AuditViolation[] = outcomes.flatMap(
    (outcome) => outcome.violations,
  );
  const staleAuthorisations = exemptionDefectsOf({
    outcomes,
    pathsOf: (outcome) => outcome.staleAuthorisedPaths,
  });
  const staleCarveOuts = exemptionDefectsOf({
    outcomes,
    pathsOf: (outcome) => outcome.staleCarvedPaths,
  });
  const doublyHeld = exemptionDefectsOf({
    outcomes,
    pathsOf: (outcome) => outcome.doublyHeldPaths,
  });
  const violations: readonly AuditViolation[] = [
    ...walkerViolations,
    ...syntheticViolationsOf({
      defects: staleAuthorisations,
      ruleSuffix: "stale authorised-location",
      snippet: "suppresses nothing; delete this entry",
    }),
    ...syntheticViolationsOf({
      defects: staleCarveOuts,
      ruleSuffix: "stale carve-out",
      snippet: "suppresses nothing; pay down or delete the entry",
    }),
    ...syntheticViolationsOf({
      defects: doublyHeld,
      ruleSuffix: "doubly-held exemption",
      snippet:
        "held as both carve-out and authorised-location; resolve to exactly one instrument",
    }),
  ];
  const scope = resolveConstitutionScope({ projectDir: flags.projectDir });
  const scannedCount = walkSourceFiles({
    rootDir: flags.projectDir,
  }).filter((filePath) =>
    isInScope({ filePath, projectDir: flags.projectDir, scope }),
  ).length;
  const reportSections = outcomes.map(formatCdSection);
  return {
    pass: violations.length === 0,
    violationsCount: violations.length,
    scannedCount,
    violations,
    staleAuthorisations,
    staleCarveOuts,
    doublyHeld,
    humanReport: reportSections.join("\n\n"),
  };
};

const main = (): void => {
  const flags = parseFlags(process.argv.slice(2));
  const outcome = runAudit(flags);

  if (flags.json) {
    const wire: Record<string, unknown> = {
      pass: outcome.pass,
      [HOOK_VIOLATIONS_COUNT_KEY]: outcome.violationsCount,
      [HOOK_SCANNED_COUNT_KEY]: outcome.scannedCount,
      [HOOK_BY_RULE_KEY]: descendingByCount(
        countBy({
          items: outcome.violations,
          keyOf: (violation) => cdIdOf(violation.rule),
        }),
      ).map(([cdId, count]) => ({ cd: cdId, count })),
      [HOOK_BY_FILE_KEY]: descendingByCount(
        countBy({
          items: outcome.violations,
          keyOf: (violation) => violation.file,
        }),
      ).map(([file, count]) => ({ file, count })),
      violations: outcome.violations,
      [HOOK_STALE_AUTHORISATIONS_KEY]: outcome.staleAuthorisations,
      [HOOK_STALE_CARVE_OUTS_KEY]: outcome.staleCarveOuts,
      [HOOK_DOUBLY_HELD_KEY]: outcome.doublyHeld,
    };
    process.stdout.write(`${JSON.stringify(wire)}\n`);
  } else {
    const scope = resolveConstitutionScope({ projectDir: flags.projectDir });
    process.stdout.write(
      `Constitution audit scope — include: [${scope.include.join(", ")}]  ` +
        `exclude: [${scope.exclude.join(", ")}]\n\n`,
    );
    process.stdout.write(`${outcome.humanReport}\n`);
    if (outcome.pass) {
      process.stdout.write(
        `\nConstitution audit: PASS — 0 violations across ${outcome.scannedCount} scanned file(s).\n`,
      );
    } else {
      process.stdout.write(
        `${formatSummary({
          violations: outcome.violations,
          scannedCount: outcome.scannedCount,
        })}\n`,
      );
      process.stdout.write(
        `\nConstitution audit: FAIL — ${outcome.violationsCount} violation(s) ` +
          `(${outcome.staleAuthorisations.length} stale authorised-location(s), ` +
          `${outcome.staleCarveOuts.length} stale carve-out(s), ` +
          `${outcome.doublyHeld.length} doubly-held exemption(s)). ` +
          `To deliberately exempt a file for a single CD, add it to that CD's own ` +
          `sidecar under ${CARVE_OUT_DIR} (e.g. ${CARVE_OUT_DIR}cd-14.json). ` +
          `A stale exemption suppresses nothing and must be deleted; a doubly-held ` +
          `file must resolve to exactly one instrument.\n`,
      );
    }
  }

  process.exit(outcome.pass ? 0 : 1);
};

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();

export type { AuditOutcome, AuditViolation, CdOutcome, ExemptionDefect };
export { cdIdOf, formatSummary, runAudit, syntheticViolationsOf };
