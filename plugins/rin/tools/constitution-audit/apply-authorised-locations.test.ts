import { expect, test } from "vitest";
import {
  type AuthorisedLocation,
  applyAuthorisedLocations,
} from "./apply-authorised-locations.js";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";

const SERVICE: ServiceAuditConfig = {
  name: "@rin/kernel",
  srcRoot: "/repo/packages/kernel/src",
  scriptsRoot: "/repo/packages/kernel/scripts",
  uiSrcRoot: "/repo/packages/kernel/ui/src",
};

const violation = ({
  rule,
  file,
}: {
  readonly rule: string;
  readonly file: string;
}): ConstitutionViolation => ({ rule, file, line: 1, snippet: "new Date()" });

const reportOf = (
  violations: readonly ConstitutionViolation[],
): AuditConstitutionReport => ({
  service: SERVICE,
  violations,
  scannedFiles: ["/repo/packages/kernel/src/clock/clock.ts"],
});

const CLOCK_TEST_AUTHORISED: AuthorisedLocation = {
  cdCode: "CD-17",
  reason: "fake clock in tests",
  files: ["packages/kernel/src/clock/mutable-clock.test.ts"],
};

test("an authorised location suppresses a matching CD violation", () => {
  const report = reportOf([
    violation({
      rule: "CD-17",
      file: "/repo/packages/kernel/src/clock/mutable-clock.test.ts",
    }),
  ]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.report.violations).toEqual([]);
});

test("a bare Date in an unauthorised production file still fails", () => {
  const productionViolation = violation({
    rule: "CD-17",
    file: "/repo/packages/kernel/src/runtime/health.ts",
  });
  const report = reportOf([productionViolation]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.report.violations).toEqual([productionViolation]);
});

test("an authorised location leaves a different CD untouched", () => {
  const otherCdViolation = violation({
    rule: "CD-6 (banned name)",
    file: "/repo/packages/kernel/src/clock/mutable-clock.test.ts",
  });
  const report = reportOf([otherCdViolation]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.report.violations).toEqual([otherCdViolation]);
});

test("an authorised location matches regardless of path separator", () => {
  const report = reportOf([
    violation({
      rule: "CD-17",
      file: "C:\\repo\\packages\\kernel\\src\\clock\\mutable-clock.test.ts",
    }),
  ]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.report.violations).toEqual([]);
});

test("an authorised location for one file does not suppress a sibling file", () => {
  const siblingViolation = violation({
    rule: "CD-17",
    file: "/repo/packages/kernel/src/clock/other-clock.test.ts",
  });
  const report = reportOf([siblingViolation]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.report.violations).toEqual([siblingViolation]);
});

test("report service and scannedFiles pass through unchanged", () => {
  const report = reportOf([
    violation({
      rule: "CD-17",
      file: "/repo/packages/kernel/src/clock/mutable-clock.test.ts",
    }),
  ]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.report.service).toBe(SERVICE);
  expect(result.report.scannedFiles).toEqual(report.scannedFiles);
});

test("applied carries the suppressed count for a firing authorised location", () => {
  const report = reportOf([
    violation({
      rule: "CD-17",
      file: "/repo/packages/kernel/src/clock/mutable-clock.test.ts",
    }),
  ]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.applied).toEqual([
    { authorisedLocation: CLOCK_TEST_AUTHORISED, suppressedCount: 1 },
  ]);
});

test("an authorised location that suppresses at least one finding is not stale", () => {
  const report = reportOf([
    violation({
      rule: "CD-17",
      file: "/repo/packages/kernel/src/clock/mutable-clock.test.ts",
    }),
  ]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.staleAuthorisedLocations).toEqual([]);
});

test("an authorised location that suppresses nothing is reported as stale", () => {
  const report = reportOf([
    violation({
      rule: "CD-17",
      file: "/repo/packages/kernel/src/runtime/health.ts",
    }),
  ]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.staleAuthorisedLocations).toEqual([CLOCK_TEST_AUTHORISED]);
});

test("an authorised location whose file yields no finding is reported as stale", () => {
  const report = reportOf([]);
  const result = applyAuthorisedLocations({
    report,
    authorisedLocations: [CLOCK_TEST_AUTHORISED],
  });
  expect(result.staleAuthorisedLocations).toEqual([CLOCK_TEST_AUTHORISED]);
});
