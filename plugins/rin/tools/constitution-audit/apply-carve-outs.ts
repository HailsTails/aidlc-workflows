import type {
  AuditConstitutionReport,
  ConstitutionViolation,
} from "./audit-constitution.js";

type CarveOut = {
  readonly service: string;
  readonly cdCode: string;
  readonly spec: string;
  readonly files?: readonly string[];
};

type FileScopedCarveOut = CarveOut & { readonly files: readonly string[] };

type WholeCdCarveOut = Omit<CarveOut, "files">;

type FileMatch =
  | {
      readonly kind: "matched";
      readonly file: string;
      readonly matchedCount: number;
    }
  | { readonly kind: "no-matches"; readonly file: string }
  | { readonly kind: "not-scanned"; readonly file: string };

type ApplyCarveOutsArgs = {
  readonly serviceName: string;
  readonly report: AuditConstitutionReport;
  readonly carveOuts: readonly CarveOut[];
};

type AppliedCarveOut =
  | {
      readonly kind: "file-scoped";
      readonly carveOut: FileScopedCarveOut;
      readonly suppressedCount: number;
      readonly fileMatches: readonly FileMatch[];
    }
  | {
      readonly kind: "whole-cd";
      readonly carveOut: WholeCdCarveOut;
      readonly suppressedCount: number;
    };

type ApplyCarveOutsResult = {
  readonly report: AuditConstitutionReport;
  readonly applied: readonly AppliedCarveOut[];
  readonly staleCarveOuts: readonly CarveOut[];
};

const CD_CODE_BOUNDARY = /[\s(]/;

const cdCodeOf = (rule: string): string => {
  const boundaryMatch = rule.match(CD_CODE_BOUNDARY);
  if (boundaryMatch?.index === undefined) {
    return rule;
  }
  return rule.slice(0, boundaryMatch.index);
};

const toPosixPath = (filePath: string): string => filePath.replace(/\\/g, "/");

const pathEndsWith = ({
  candidate,
  suffix,
}: {
  readonly candidate: string;
  readonly suffix: string;
}): boolean => toPosixPath(candidate).endsWith(toPosixPath(suffix));

const violationMatchesFiles = ({
  violation,
  files,
}: {
  readonly violation: ConstitutionViolation;
  readonly files: readonly string[];
}): boolean =>
  files.some((carveOutFile) =>
    pathEndsWith({ candidate: violation.file, suffix: carveOutFile }),
  );

const fileWasScanned = ({
  file,
  scannedFiles,
}: {
  readonly file: string;
  readonly scannedFiles: readonly string[];
}): boolean =>
  scannedFiles.some((scannedFile) =>
    pathEndsWith({ candidate: scannedFile, suffix: file }),
  );

const fileMatchesFor = ({
  report,
  carveOut,
}: {
  readonly report: AuditConstitutionReport;
  readonly carveOut: FileScopedCarveOut;
}): readonly FileMatch[] =>
  carveOut.files.map((file) => {
    if (!fileWasScanned({ file, scannedFiles: report.scannedFiles })) {
      return { kind: "not-scanned", file };
    }
    const matchedCount = report.violations.filter(
      (violation) =>
        cdCodeOf(violation.rule) === carveOut.cdCode &&
        violationMatchesFiles({ violation, files: [file] }),
    ).length;
    if (matchedCount === 0) {
      return { kind: "no-matches", file };
    }
    return { kind: "matched", file, matchedCount };
  });

const violationMatchesCarveOut = ({
  violation,
  carveOut,
}: {
  readonly violation: ConstitutionViolation;
  readonly carveOut: CarveOut;
}): boolean => {
  if (cdCodeOf(violation.rule) !== carveOut.cdCode) {
    return false;
  }
  if (carveOut.files === undefined) {
    return true;
  }
  return violationMatchesFiles({ violation, files: carveOut.files });
};

const carveOutsForService = ({
  serviceName,
  carveOuts,
}: {
  readonly serviceName: string;
  readonly carveOuts: readonly CarveOut[];
}): readonly CarveOut[] =>
  carveOuts.filter((carveOut) => carveOut.service === serviceName);

const countSuppressed = ({
  violations,
  carveOut,
}: {
  readonly violations: readonly ConstitutionViolation[];
  readonly carveOut: CarveOut;
}): number =>
  violations.filter((violation) =>
    violationMatchesCarveOut({ violation, carveOut }),
  ).length;

const isSuppressed = ({
  violation,
  carveOuts,
}: {
  readonly violation: ConstitutionViolation;
  readonly carveOuts: readonly CarveOut[];
}): boolean =>
  carveOuts.some((carveOut) =>
    violationMatchesCarveOut({ violation, carveOut }),
  );

const applyCarveOuts = ({
  serviceName,
  report,
  carveOuts,
}: ApplyCarveOutsArgs): ApplyCarveOutsResult => {
  const serviceCarveOuts = carveOutsForService({ serviceName, carveOuts });
  const remainingViolations = report.violations.filter(
    (violation) => !isSuppressed({ violation, carveOuts: serviceCarveOuts }),
  );
  const applied: readonly AppliedCarveOut[] = serviceCarveOuts.map(
    (carveOut) => {
      const suppressedCount = countSuppressed({
        violations: report.violations,
        carveOut,
      });
      if (carveOut.files === undefined) {
        const { files: _files, ...wholeCdCarveOut } = carveOut;
        return { kind: "whole-cd", carveOut: wholeCdCarveOut, suppressedCount };
      }
      const fileScopedCarveOut = { ...carveOut, files: carveOut.files };
      return {
        kind: "file-scoped",
        carveOut: fileScopedCarveOut,
        suppressedCount,
        fileMatches: fileMatchesFor({ report, carveOut: fileScopedCarveOut }),
      };
    },
  );
  const staleCarveOuts = applied
    .filter((appliedCarveOut) => appliedCarveOut.suppressedCount === 0)
    .map((appliedCarveOut) => appliedCarveOut.carveOut);
  return {
    report: { ...report, violations: remainingViolations },
    applied,
    staleCarveOuts,
  };
};

export {
  type AppliedCarveOut,
  type ApplyCarveOutsArgs,
  type ApplyCarveOutsResult,
  applyCarveOuts,
  type CarveOut,
  cdCodeOf,
  type FileMatch,
  type FileScopedCarveOut,
  type WholeCdCarveOut,
};
