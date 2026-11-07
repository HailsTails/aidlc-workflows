import { existsSync, readFileSync, statSync } from "node:fs";
import {
  type AuditConstitutionReport,
  auditBooleanParameters,
  auditCastExpressions,
  auditConstitution,
  auditIdentifierNames,
  auditInputMutation,
  auditTestDiscipline,
  auditTsconfigStrict,
  type ServiceAuditConfig,
  walkSourceFiles,
} from "./constitution-audit/index.ts";
import { loadAuthorisedLocationsForCd } from "./rin-harness-cd-authorised-locations.ts";
import { loadCarveOutsForCd } from "./rin-harness-cd-carve-outs.ts";
import {
  filePathIsInScope,
  filterReportToScope,
  isInScope,
  resolveConstitutionScope,
  ruleSurvivesScriptRelaxation,
  wholeProjectService,
} from "./rin-harness-constitution-scope.ts";
import {
  type PathFlavour,
  type PathOperations,
  pathOperationsFor,
} from "./rin-harness-path-operations.ts";
import { auditSource } from "./rin-harness-sensor-cd-extras.ts";

type WalkerId =
  | "constitution"
  | "cast-expressions"
  | "identifier-names"
  | "input-mutation"
  | "boolean-parameters"
  | "test-discipline"
  | "tsconfig-strict"
  | "line-scan";

type CdEnforcement = {
  readonly cdId: string;
  readonly walker: WalkerId;
  readonly rulePrefixes: readonly string[];
};

type AstWalkerId = Exclude<WalkerId, "line-scan">;

type Violation = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
};

type ExemptionOutcome = {
  readonly violations: readonly Violation[];
  readonly staleAuthorisedPaths: readonly string[];
  readonly staleCarvedPaths: readonly string[];
  readonly doublyHeldPaths: readonly string[];
};

const WALKERS: Readonly<
  Record<
    AstWalkerId,
    (args: { readonly service: ServiceAuditConfig }) => AuditConstitutionReport
  >
> = {
  constitution: auditConstitution,
  "cast-expressions": auditCastExpressions,
  "identifier-names": auditIdentifierNames,
  "input-mutation": auditInputMutation,
  "boolean-parameters": auditBooleanParameters,
  "test-discipline": auditTestDiscipline,
  "tsconfig-strict": auditTsconfigStrict,
};

const CD_ENFORCEMENT: readonly CdEnforcement[] = [
  { cdId: "CD-1", walker: "cast-expressions", rulePrefixes: ["CD-1", "CD-2"] },
  { cdId: "CD-2", walker: "cast-expressions", rulePrefixes: ["CD-2"] },
  { cdId: "CD-3", walker: "tsconfig-strict", rulePrefixes: ["CD-3"] },
  { cdId: "CD-5", walker: "constitution", rulePrefixes: ["CD-5"] },
  { cdId: "CD-6", walker: "identifier-names", rulePrefixes: ["CD-6"] },
  { cdId: "CD-7", walker: "constitution", rulePrefixes: ["CD-7"] },
  { cdId: "CD-14", walker: "constitution", rulePrefixes: ["CD-14"] },
  { cdId: "CD-17", walker: "constitution", rulePrefixes: ["CD-17"] },
  {
    cdId: "CD-19",
    walker: "constitution",
    rulePrefixes: ["CD-19", "CD-20"],
  },
  {
    cdId: "CD-23",
    walker: "constitution",
    rulePrefixes: ["CD-23", "CD-24", "CD-23/24"],
  },
  { cdId: "CD-10", walker: "test-discipline", rulePrefixes: ["CD-10"] },
  { cdId: "CD-25", walker: "test-discipline", rulePrefixes: ["CD-25"] },
  { cdId: "CD-26", walker: "test-discipline", rulePrefixes: ["CD-26"] },
  { cdId: "CD-27", walker: "test-discipline", rulePrefixes: ["CD-27"] },
  {
    cdId: "CD-43",
    walker: "boolean-parameters",
    rulePrefixes: ["CD-43"],
  },
  { cdId: "CD-44", walker: "input-mutation", rulePrefixes: ["CD-44"] },
  { cdId: "CD-7a", walker: "line-scan", rulePrefixes: ["CD-7a"] },
  { cdId: "CD-8", walker: "line-scan", rulePrefixes: ["CD-8"] },
  { cdId: "CD-15", walker: "line-scan", rulePrefixes: ["CD-15", "CD-16"] },
];

const insideNormalPathMarker: unique symbol = Symbol("inside-normal-path");

type InsideNormalPath = {
  readonly kind: "inside";
  readonly flavour: PathFlavour;
  readonly path: string;
  readonly [insideNormalPathMarker]: true;
};

type NormalPath = InsideNormalPath | { readonly kind: "outside" };

const climbsOutOfProject = ({
  forwardSlashed,
}: {
  readonly forwardSlashed: string;
}): boolean => forwardSlashed === ".." || forwardSlashed.startsWith("../");

const normalPathOf = ({
  pathOperations,
  projectDir,
  path,
}: {
  readonly pathOperations: PathOperations;
  readonly projectDir: string;
  readonly path: string;
}): NormalPath => {
  const projectRoot = pathOperations.resolve({ segments: [projectDir] });
  const relativePath = pathOperations.relative({
    from: projectRoot,
    to: pathOperations.resolve({ segments: [projectRoot, path] }),
  });
  const forwardSlashed = relativePath.replace(/\\/g, "/");
  if (
    pathOperations.isAbsolute({ path: relativePath }) ||
    climbsOutOfProject({ forwardSlashed })
  ) {
    return { kind: "outside" };
  }
  return {
    kind: "inside",
    flavour: pathOperations.flavour,
    path: forwardSlashed,
    [insideNormalPathMarker]: true,
  };
};

const comparableFormOf = ({
  insidePath,
}: {
  readonly insidePath: InsideNormalPath;
}): string =>
  insidePath.flavour === "win32"
    ? insidePath.path.toLowerCase()
    : insidePath.path;

const isSameNormalPath = ({
  left,
  right,
}: {
  readonly left: NormalPath;
  readonly right: NormalPath;
}): boolean => {
  if (left.kind === "outside" || right.kind === "outside") {
    return false;
  }
  return (
    left.flavour === right.flavour &&
    comparableFormOf({ insidePath: left }) ===
      comparableFormOf({ insidePath: right })
  );
};

type SensorEvaluation = "file" | "project" | "not-evaluated";

type CdSensorResult = {
  readonly evaluation: SensorEvaluation;
  readonly cd: string;
  readonly violations: readonly Violation[];
  readonly scanned: string;
  readonly staleAuthorisedPaths: readonly string[];
  readonly staleCarvedPaths: readonly string[];
  readonly doublyHeldPaths: readonly string[];
};

const enforcementFor = (cdId: string): CdEnforcement | undefined =>
  CD_ENFORCEMENT.find((entry) => entry.cdId === cdId);

const CD1_ANY_PATTERN = /\bas\s+any\b|:\s*any\b|<any>/;

const ruleMatchesCd = ({
  rule,
  prefixes,
}: {
  readonly rule: string;
  readonly prefixes: readonly string[];
}): boolean =>
  prefixes.some(
    (prefix) =>
      rule === prefix ||
      rule.startsWith(`${prefix} `) ||
      rule.startsWith(`${prefix}(`) ||
      rule.startsWith(`${prefix}/`),
  );

const cd1Violations = ({
  walkerViolations,
}: {
  readonly walkerViolations: readonly Violation[];
}): readonly Violation[] =>
  walkerViolations
    .filter((violation) => CD1_ANY_PATTERN.test(violation.snippet))
    .map((violation) => ({
      ...violation,
      rule: "CD-1 (no `any` — an any-cast surfaced by the cast walker; use `unknown` and narrow)",
    }));

const scopedReportForWalker = ({
  walker,
  projectDir,
}: {
  readonly walker: AstWalkerId;
  readonly projectDir: string;
}): AuditConstitutionReport => {
  const scope = resolveConstitutionScope({ projectDir });
  const service = wholeProjectService({ projectDir });
  return filterReportToScope({
    report: WALKERS[walker]({ service }),
    projectDir,
    scope,
  });
};

const toViolation = ({
  rule,
  file,
  line,
  snippet,
  projectDir,
}: {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
  readonly projectDir: string;
}): Violation => ({
  rule,
  file: file
    .replace(/\\/g, "/")
    .replace(`${projectDir.replace(/\\/g, "/")}/`, ""),
  line,
  snippet,
});

const lineScanViolations = ({
  projectDir,
}: {
  readonly projectDir: string;
}): readonly Violation[] => {
  const scope = resolveConstitutionScope({ projectDir });
  return walkSourceFiles({ rootDir: projectDir })
    .filter((filePath) => isInScope({ filePath, projectDir, scope }))
    .flatMap((filePath) =>
      auditSource(readFileSync(filePath, "utf-8")).map((lineFinding) =>
        toViolation({
          rule: lineFinding.rule,
          file: filePath,
          line: lineFinding.line,
          snippet: lineFinding.snippet,
          projectDir,
        }),
      ),
    )
    .filter((violation) =>
      ruleSurvivesScriptRelaxation({
        filePath: violation.file,
        rule: violation.rule,
        projectDir,
        scope,
      }),
    );
};

const astWalkerViolations = ({
  walker,
  projectDir,
}: {
  readonly walker: AstWalkerId;
  readonly projectDir: string;
}): readonly Violation[] =>
  scopedReportForWalker({ walker, projectDir }).violations.map(
    (reportViolation) => toViolation({ ...reportViolation, projectDir }),
  );

const matchesExemptPath = ({
  file,
  exemptPath,
}: {
  readonly file: string;
  readonly exemptPath: string;
}): boolean =>
  file.replace(/\\/g, "/").endsWith(exemptPath.replace(/\\/g, "/"));

const unmatchedExemptPathsOf = ({
  exemptPaths,
  violations,
}: {
  readonly exemptPaths: readonly string[];
  readonly violations: readonly Violation[];
}): readonly string[] =>
  exemptPaths.filter(
    (exemptPath) =>
      !violations.some((violation) =>
        matchesExemptPath({ file: violation.file, exemptPath }),
      ),
  );

const normalizedPath = (path: string): string => path.replace(/\\/g, "/");

const doublyHeldPathsOf = ({
  carvedFiles,
  authorisedPaths,
}: {
  readonly carvedFiles: readonly string[];
  readonly authorisedPaths: readonly string[];
}): readonly string[] => {
  const authorisedNormalized = authorisedPaths.map(normalizedPath);
  return carvedFiles.filter((carvedFile) =>
    authorisedNormalized.includes(normalizedPath(carvedFile)),
  );
};

const exemptionOutcomeOf = ({
  violations,
  carvedFiles,
  authorisedPaths,
}: {
  readonly violations: readonly Violation[];
  readonly carvedFiles: readonly string[];
  readonly authorisedPaths: readonly string[];
}): ExemptionOutcome => {
  if (carvedFiles.length === 0 && authorisedPaths.length === 0) {
    return {
      violations,
      staleAuthorisedPaths: [],
      staleCarvedPaths: [],
      doublyHeldPaths: [],
    };
  }
  const suppressedByEitherInstrument = (violation: Violation): boolean =>
    carvedFiles.some((exemptPath) =>
      matchesExemptPath({ file: violation.file, exemptPath }),
    ) ||
    authorisedPaths.some((exemptPath) =>
      matchesExemptPath({ file: violation.file, exemptPath }),
    );
  return {
    violations: violations.filter(
      (violation) => !suppressedByEitherInstrument(violation),
    ),
    staleAuthorisedPaths: unmatchedExemptPathsOf({
      exemptPaths: authorisedPaths,
      violations,
    }),
    staleCarvedPaths: unmatchedExemptPathsOf({
      exemptPaths: carvedFiles,
      violations,
    }),
    doublyHeldPaths: doublyHeldPathsOf({ carvedFiles, authorisedPaths }),
  };
};

const suppressOwnExemptions = ({
  cdId,
  projectDir,
  violations,
}: {
  readonly cdId: string;
  readonly projectDir: string;
  readonly violations: readonly Violation[];
}): ExemptionOutcome =>
  exemptionOutcomeOf({
    violations,
    carvedFiles: loadCarveOutsForCd({ projectDir, cdId }).flatMap(
      (carveOut) => carveOut.files ?? [],
    ),
    authorisedPaths: loadAuthorisedLocationsForCd({ projectDir, cdId }).flatMap(
      (authorisedLocation) => authorisedLocation.files,
    ),
  });

const filteredToCd = ({
  enforcement,
  walkerViolations,
}: {
  readonly enforcement: CdEnforcement;
  readonly walkerViolations: readonly Violation[];
}): readonly Violation[] => {
  if (enforcement.cdId === "CD-1") {
    return cd1Violations({ walkerViolations });
  }
  if (enforcement.cdId === "CD-2") {
    return walkerViolations.filter(
      (violation) =>
        ruleMatchesCd({ rule: violation.rule, prefixes: ["CD-2"] }) &&
        !CD1_ANY_PATTERN.test(violation.snippet),
    );
  }
  return walkerViolations.filter((violation) =>
    ruleMatchesCd({ rule: violation.rule, prefixes: enforcement.rulePrefixes }),
  );
};

const walkerViolationsCache = new Map<string, readonly Violation[]>();

const rawViolationsForWalker = ({
  walker,
  projectDir,
}: {
  readonly walker: WalkerId;
  readonly projectDir: string;
}): readonly Violation[] => {
  const cacheKey = `${walker}|${projectDir}`;
  const cached = walkerViolationsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const produced =
    walker === "line-scan"
      ? lineScanViolations({ projectDir })
      : astWalkerViolations({ walker, projectDir });
  walkerViolationsCache.set(cacheKey, produced);
  return produced;
};

const violationsForCd = ({
  enforcement,
  projectDir,
}: {
  readonly enforcement: CdEnforcement;
  readonly projectDir: string;
}): ExemptionOutcome =>
  suppressOwnExemptions({
    cdId: enforcement.cdId,
    projectDir,
    violations: filteredToCd({
      enforcement,
      walkerViolations: rawViolationsForWalker({
        walker: enforcement.walker,
        projectDir,
      }),
    }),
  });

const notEvaluatedResultOf = ({
  cd,
  scanned,
}: {
  readonly cd: string;
  readonly scanned: string;
}): CdSensorResult => ({
  evaluation: "not-evaluated",
  cd,
  violations: [],
  scanned,
  staleAuthorisedPaths: [],
  staleCarvedPaths: [],
  doublyHeldPaths: [],
});

const scannedTextOf = ({
  pathOperations,
  projectDir,
  target,
  suffix,
}: {
  readonly pathOperations: PathOperations;
  readonly projectDir: string;
  readonly target: string;
  readonly suffix: string;
}): string => {
  const targetPath = normalPathOf({ pathOperations, projectDir, path: target });
  return targetPath.kind === "inside"
    ? `${targetPath.path}${suffix}`
    : `${target}${suffix}`;
};

const projectModeResultOf = ({
  cd,
  walker,
  outcome,
}: {
  readonly cd: string;
  readonly walker: WalkerId;
  readonly outcome: ExemptionOutcome;
}): CdSensorResult => ({
  evaluation: "project",
  cd,
  violations: outcome.violations,
  scanned: `project scope, ${walker} walker filtered to ${cd}`,
  staleAuthorisedPaths: outcome.staleAuthorisedPaths,
  staleCarvedPaths: outcome.staleCarvedPaths,
  doublyHeldPaths: outcome.doublyHeldPaths,
});

const runCdSensorProjectMode = ({
  cdId,
  projectDir,
}: {
  readonly cdId: string;
  readonly projectDir: string;
}): CdSensorResult => {
  const enforcement = enforcementFor(cdId);
  if (enforcement === undefined) {
    return notEvaluatedResultOf({ cd: cdId, scanned: "(no enforcement)" });
  }
  return projectModeResultOf({
    cd: cdId,
    walker: enforcement.walker,
    outcome: violationsForCd({ enforcement, projectDir }),
  });
};

const cdSensorPassOf = ({
  sensorResult,
}: {
  readonly sensorResult: CdSensorResult;
}): boolean => {
  switch (sensorResult.evaluation) {
    case "file":
      return sensorResult.violations.length === 0;
    case "project":
      return (
        sensorResult.violations.length === 0 &&
        sensorResult.staleAuthorisedPaths.length === 0 &&
        sensorResult.staleCarvedPaths.length === 0 &&
        sensorResult.doublyHeldPaths.length === 0
      );
    case "not-evaluated":
      return true;
  }
};

const violationsInTargetOf = ({
  targetPath,
  projectDir,
  pathOperations,
  projectViolations,
}: {
  readonly targetPath: InsideNormalPath;
  readonly projectDir: string;
  readonly pathOperations: PathOperations;
  readonly projectViolations: readonly Violation[];
}): readonly Violation[] =>
  projectViolations.flatMap((violation) => {
    const violationPath = normalPathOf({
      pathOperations,
      projectDir,
      path: violation.file,
    });
    if (
      violationPath.kind === "outside" ||
      !isSameNormalPath({ left: targetPath, right: violationPath })
    ) {
      return [];
    }
    return [{ ...violation, file: violationPath.path }];
  });

const fileModeResultOf = ({
  cd,
  target,
  projectDir,
  pathOperations,
  outcome,
}: {
  readonly cd: string;
  readonly target: string;
  readonly projectDir: string;
  readonly pathOperations: PathOperations;
  readonly outcome: ExemptionOutcome;
}): CdSensorResult => {
  const targetPath = normalPathOf({ pathOperations, projectDir, path: target });
  if (targetPath.kind === "outside") {
    return notEvaluatedResultOf({ cd, scanned: `${target} (out of scope)` });
  }
  return {
    evaluation: "file",
    cd,
    violations: violationsInTargetOf({
      targetPath,
      projectDir,
      pathOperations,
      projectViolations: outcome.violations,
    }),
    scanned: targetPath.path,
    staleAuthorisedPaths: [],
    staleCarvedPaths: [],
    doublyHeldPaths: [],
  };
};

const runCdSensorFileMode = ({
  cdId,
  target,
  projectDir,
  pathOperations,
}: {
  readonly cdId: string;
  readonly target: string;
  readonly projectDir: string;
  readonly pathOperations: PathOperations;
}): CdSensorResult => {
  const enforcement = enforcementFor(cdId);
  if (enforcement === undefined) {
    return notEvaluatedResultOf({ cd: cdId, scanned: target });
  }
  if (!filePathIsInScope({ filePath: target, projectDir })) {
    return notEvaluatedResultOf({
      cd: cdId,
      scanned: scannedTextOf({
        pathOperations,
        projectDir,
        target,
        suffix: " (out of scope)",
      }),
    });
  }
  return fileModeResultOf({
    cd: cdId,
    target,
    projectDir,
    pathOperations,
    outcome: violationsForCd({ enforcement, projectDir }),
  });
};

type WriterNotice =
  | { readonly kind: "silent" }
  | { readonly kind: "notice"; readonly text: string };

const WRITER_NOTICE_VIOLATION_LIMIT = 10;
const WRITER_NOTICE_SNIPPET_LIMIT = 160;

const noticeSnippetOf = ({ snippet }: { readonly snippet: string }): string =>
  (snippet.split(/\r?\n/, 1).at(0) ?? "").slice(0, WRITER_NOTICE_SNIPPET_LIMIT);

const writerNoticeOf = ({
  cd,
  violations,
}: {
  readonly cd: string;
  readonly violations: readonly Violation[];
}): WriterNotice => {
  if (violations.length === 0) {
    return { kind: "silent" };
  }
  const listed = violations
    .slice(0, WRITER_NOTICE_VIOLATION_LIMIT)
    .map(
      (violation) =>
        `${violation.rule} ${violation.file}:${violation.line} — ${noticeSnippetOf({ snippet: violation.snippet })}`,
    );
  const remaining = violations.length - listed.length;
  const overflow =
    remaining > 0
      ? [`… and ${remaining} more ${cd} violations in this file`]
      : [];
  return { kind: "notice", text: [...listed, ...overflow].join("\n") };
};

type EntryFlags = {
  readonly filePath?: string;
  readonly outputPath?: string;
  readonly projectDir?: string;
};

const parseEntryFlags = (argv: readonly string[]): EntryFlags => {
  const findValue = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    filePath: findValue("--file-path"),
    outputPath: findValue("--output-path"),
    projectDir: findValue("--project-dir"),
  };
};

const UPSTREAM_FINDINGS_COUNT_KEY = "findings_count";
const UPSTREAM_STALE_AUTHORISED_PATHS_KEY = "stale_authorised_paths";
const UPSTREAM_STALE_CARVED_PATHS_KEY = "stale_carved_paths";
const UPSTREAM_DOUBLY_HELD_PATHS_KEY = "doubly_held_paths";
const UPSTREAM_WRITER_NOTICE_KEY = "writer_notice";

type CdSensorWire = {
  readonly pass: boolean;
  readonly cd: string;
  readonly [UPSTREAM_FINDINGS_COUNT_KEY]: number;
  readonly findings: readonly Violation[];
  readonly scanned: string;
  readonly [UPSTREAM_STALE_AUTHORISED_PATHS_KEY]: readonly string[];
  readonly [UPSTREAM_STALE_CARVED_PATHS_KEY]: readonly string[];
  readonly [UPSTREAM_DOUBLY_HELD_PATHS_KEY]: readonly string[];
  readonly [UPSTREAM_WRITER_NOTICE_KEY]?: string;
};

const writerNoticeForEvaluationOf = ({
  sensorResult,
}: {
  readonly sensorResult: CdSensorResult;
}): WriterNotice => {
  switch (sensorResult.evaluation) {
    case "file":
      return writerNoticeOf({
        cd: sensorResult.cd,
        violations: sensorResult.violations,
      });
    case "project":
      return { kind: "silent" };
    case "not-evaluated":
      return { kind: "silent" };
  }
};

const cdSensorWireOf = ({
  result: sensorResult,
}: {
  readonly result: CdSensorResult;
}): CdSensorWire => {
  const writerNotice = writerNoticeForEvaluationOf({ sensorResult });
  return {
    pass: cdSensorPassOf({ sensorResult }),
    cd: sensorResult.cd,
    [UPSTREAM_FINDINGS_COUNT_KEY]: sensorResult.violations.length,
    findings: sensorResult.violations,
    scanned: sensorResult.scanned,
    [UPSTREAM_STALE_AUTHORISED_PATHS_KEY]: sensorResult.staleAuthorisedPaths,
    [UPSTREAM_STALE_CARVED_PATHS_KEY]: sensorResult.staleCarvedPaths,
    [UPSTREAM_DOUBLY_HELD_PATHS_KEY]: sensorResult.doublyHeldPaths,
    ...(writerNotice.kind === "notice"
      ? { [UPSTREAM_WRITER_NOTICE_KEY]: writerNotice.text }
      : {}),
  };
};

const cdSensorWireLineOf = ({
  sensorResult,
}: {
  readonly sensorResult: CdSensorResult;
}): string => `${JSON.stringify(cdSensorWireOf({ result: sensorResult }))}\n`;

const emit = (sensorResult: CdSensorResult): never => {
  process.stdout.write(cdSensorWireLineOf({ sensorResult }));
  process.exit(0);
};

const claudeProjectDirFromEnv = (): string | undefined =>
  process.env.CLAUDE_PROJECT_DIR;

const hostPathFlavour = (): PathFlavour =>
  process.platform === "win32" ? "win32" : "posix";

const runCdSensor = ({ cdId }: { readonly cdId: string }): never => {
  const pathOperations = pathOperationsFor({ flavour: hostPathFlavour() });
  const flags = parseEntryFlags(process.argv.slice(2));
  const projectDir = pathOperations.resolve({
    segments: [flags.projectDir ?? claudeProjectDirFromEnv() ?? process.cwd()],
  });
  const target = flags.filePath ?? flags.outputPath;
  if (target !== undefined) {
    if (!existsSync(target) || !statSync(target).isFile()) {
      return emit(
        notEvaluatedResultOf({
          cd: cdId,
          scanned: scannedTextOf({
            pathOperations,
            projectDir,
            target,
            suffix: " (missing)",
          }),
        }),
      );
    }
    return emit(
      runCdSensorFileMode({ cdId, target, projectDir, pathOperations }),
    );
  }
  return emit(runCdSensorProjectMode({ cdId, projectDir }));
};

export type {
  CdEnforcement,
  CdSensorResult,
  CdSensorWire,
  ExemptionOutcome,
  NormalPath,
  SensorEvaluation,
  Violation,
  WalkerId,
  WriterNotice,
};
export {
  CD_ENFORCEMENT,
  cdSensorPassOf,
  cdSensorWireLineOf,
  cdSensorWireOf,
  doublyHeldPathsOf,
  enforcementFor,
  exemptionOutcomeOf,
  fileModeResultOf,
  isSameNormalPath,
  normalPathOf,
  projectModeResultOf,
  runCdSensor,
  runCdSensorFileMode,
  runCdSensorProjectMode,
  scannedTextOf,
  unmatchedExemptPathsOf,
  violationsForCd,
  WRITER_NOTICE_SNIPPET_LIMIT,
  WRITER_NOTICE_VIOLATION_LIMIT,
  writerNoticeOf,
};
