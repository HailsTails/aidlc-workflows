import { cdCodeOf } from "./apply-carve-outs.js";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
} from "./audit-constitution.js";

type AuthorisedLocation = {
  readonly cdCode: string;
  readonly reason: string;
  readonly files: readonly string[];
};

type ApplyAuthorisedLocationsArgs = {
  readonly report: AuditConstitutionReport;
  readonly authorisedLocations: readonly AuthorisedLocation[];
};

type AppliedAuthorisedLocation = {
  readonly authorisedLocation: AuthorisedLocation;
  readonly suppressedCount: number;
};

type ApplyAuthorisedLocationsResult = {
  readonly report: AuditConstitutionReport;
  readonly applied: readonly AppliedAuthorisedLocation[];
  readonly staleAuthorisedLocations: readonly AuthorisedLocation[];
};

const toPosixPath = (filePath: string): string => filePath.replace(/\\/g, "/");

const violationMatchesAuthorisedLocation = ({
  violation,
  authorisedLocation,
}: {
  readonly violation: ConstitutionViolation;
  readonly authorisedLocation: AuthorisedLocation;
}): boolean => {
  if (cdCodeOf(violation.rule) !== authorisedLocation.cdCode) {
    return false;
  }
  const violationPath = toPosixPath(violation.file);
  return authorisedLocation.files.some((authorisedFile) =>
    violationPath.endsWith(toPosixPath(authorisedFile)),
  );
};

const isAuthorised = ({
  violation,
  authorisedLocations,
}: {
  readonly violation: ConstitutionViolation;
  readonly authorisedLocations: readonly AuthorisedLocation[];
}): boolean =>
  authorisedLocations.some((authorisedLocation) =>
    violationMatchesAuthorisedLocation({ violation, authorisedLocation }),
  );

const countSuppressed = ({
  violations,
  authorisedLocation,
}: {
  readonly violations: readonly ConstitutionViolation[];
  readonly authorisedLocation: AuthorisedLocation;
}): number =>
  violations.filter((violation) =>
    violationMatchesAuthorisedLocation({ violation, authorisedLocation }),
  ).length;

const applyAuthorisedLocations = ({
  report,
  authorisedLocations,
}: ApplyAuthorisedLocationsArgs): ApplyAuthorisedLocationsResult => {
  const remainingViolations = report.violations.filter(
    (violation) => !isAuthorised({ violation, authorisedLocations }),
  );
  const applied = authorisedLocations.map((authorisedLocation) => ({
    authorisedLocation,
    suppressedCount: countSuppressed({
      violations: report.violations,
      authorisedLocation,
    }),
  }));
  const staleAuthorisedLocations = applied
    .filter(
      (appliedAuthorisedLocation) =>
        appliedAuthorisedLocation.suppressedCount === 0,
    )
    .map(
      (appliedAuthorisedLocation) =>
        appliedAuthorisedLocation.authorisedLocation,
    );
  return {
    report: { ...report, violations: remainingViolations },
    applied,
    staleAuthorisedLocations,
  };
};

export {
  type AppliedAuthorisedLocation,
  type ApplyAuthorisedLocationsArgs,
  type ApplyAuthorisedLocationsResult,
  type AuthorisedLocation,
  applyAuthorisedLocations,
};
