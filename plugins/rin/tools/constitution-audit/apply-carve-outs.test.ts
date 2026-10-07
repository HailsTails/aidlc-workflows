import { expect, test } from "vitest";
import { applyCarveOuts, type CarveOut, cdCodeOf } from "./apply-carve-outs.js";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";

const SERVICE: ServiceAuditConfig = {
  name: "@rin/gateway",
  srcRoot: "/repo/apps/gateway/src",
  scriptsRoot: "/repo/apps/gateway/scripts",
  uiSrcRoot: "/repo/apps/gateway/ui/src",
};

const violation = ({
  rule,
  file,
}: {
  readonly rule: string;
  readonly file: string;
}): ConstitutionViolation => ({ rule, file, line: 1, snippet: "snippet" });

const reportOf = (
  violations: readonly ConstitutionViolation[],
): AuditConstitutionReport => ({
  service: SERVICE,
  violations,
  scannedFiles: ["/repo/apps/gateway/src/index.ts"],
});

test("cdCodeOf extracts the leading code before a space", () => {
  expect(cdCodeOf("CD-6 (banned name `c`)")).toBe("CD-6");
});

test("cdCodeOf extracts the leading code before an open paren", () => {
  expect(cdCodeOf("CD-2(cast)")).toBe("CD-2");
});

test("cdCodeOf returns the whole rule when there is no boundary", () => {
  expect(cdCodeOf("CD-7")).toBe("CD-7");
});

test("cdCodeOf preserves compound codes", () => {
  expect(cdCodeOf("CD-23/24 (missing sibling)")).toBe("CD-23/24");
});

test("a service-wide CD carve-out suppresses every matching violation", () => {
  const report = reportOf([
    violation({ rule: "CD-6 (banned name)", file: "/repo/a.ts" }),
    violation({ rule: "CD-6 (banned name)", file: "/repo/b.ts" }),
  ]);
  const carveOut: CarveOut = {
    service: "@rin/gateway",
    cdCode: "CD-6",
    spec: "060",
  };
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [carveOut],
  });
  expect(result.report.violations).toEqual([]);
});

test("a CD carve-out leaves other CD violations untouched", () => {
  const survivingViolation = violation({
    rule: "CD-2 (cast)",
    file: "/repo/a.ts",
  });
  const report = reportOf([
    violation({ rule: "CD-6 (banned name)", file: "/repo/a.ts" }),
    survivingViolation,
  ]);
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [{ service: "@rin/gateway", cdCode: "CD-6", spec: "060" }],
  });
  expect(result.report.violations).toEqual([survivingViolation]);
});

test("a file-scoped carve-out suppresses only the named file", () => {
  const otherFileViolation = violation({
    rule: "CD-7 (categorical)",
    file: "/repo/apps/gateway/src/other.ts",
  });
  const report = reportOf([
    violation({
      rule: "CD-7 (categorical)",
      file: "/repo/apps/gateway/src/types.ts",
    }),
    otherFileViolation,
  ]);
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [
      {
        service: "@rin/gateway",
        cdCode: "CD-7",
        spec: "061",
        files: ["apps/gateway/src/types.ts"],
      },
    ],
  });
  expect(result.report.violations).toEqual([otherFileViolation]);
});

test("a file-scoped carve-out matches regardless of path separator", () => {
  const report = reportOf([
    violation({
      rule: "CD-7 (categorical)",
      file: "C:\\repo\\apps\\gateway\\src\\types.ts",
    }),
  ]);
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [
      {
        service: "@rin/gateway",
        cdCode: "CD-7",
        spec: "061",
        files: ["apps/gateway/src/types.ts"],
      },
    ],
  });
  expect(result.report.violations).toEqual([]);
});

test("carve-outs scoped to another service do not apply", () => {
  const report = reportOf([
    violation({ rule: "CD-6 (banned name)", file: "/repo/a.ts" }),
  ]);
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [{ service: "@example/task-service", cdCode: "CD-6", spec: "060" }],
  });
  expect(result.report.violations).toEqual(report.violations);
});

test("applied carries the whole-cd arm with the suppressed count for a firing carve-out", () => {
  const report = reportOf([
    violation({ rule: "CD-6 (banned name)", file: "/repo/a.ts" }),
    violation({ rule: "CD-6 (banned name)", file: "/repo/b.ts" }),
  ]);
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [{ service: "@rin/gateway", cdCode: "CD-6", spec: "060" }],
  });
  expect(result.applied).toEqual([
    {
      kind: "whole-cd",
      carveOut: { service: "@rin/gateway", cdCode: "CD-6", spec: "060" },
      suppressedCount: 2,
    },
  ]);
});

const reportWithScanned = ({
  violations,
  scannedFiles,
}: {
  readonly violations: readonly ConstitutionViolation[];
  readonly scannedFiles: readonly string[];
}): AuditConstitutionReport => ({ service: SERVICE, violations, scannedFiles });

test("a partially-clean file-scoped carve-out shows one matched and two no-matches", () => {
  const report = reportWithScanned({
    violations: [
      violation({
        rule: "CD-7 (categorical)",
        file: "/repo/apps/gateway/src/a.ts",
      }),
    ],
    scannedFiles: [
      "/repo/apps/gateway/src/a.ts",
      "/repo/apps/gateway/src/b.ts",
      "/repo/apps/gateway/src/c.ts",
    ],
  });
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [
      {
        service: "@rin/gateway",
        cdCode: "CD-7",
        spec: "061",
        files: [
          "apps/gateway/src/a.ts",
          "apps/gateway/src/b.ts",
          "apps/gateway/src/c.ts",
        ],
      },
    ],
  });
  expect(result.applied).toEqual([
    {
      kind: "file-scoped",
      carveOut: {
        service: "@rin/gateway",
        cdCode: "CD-7",
        spec: "061",
        files: [
          "apps/gateway/src/a.ts",
          "apps/gateway/src/b.ts",
          "apps/gateway/src/c.ts",
        ],
      },
      suppressedCount: 1,
      fileMatches: [
        { kind: "matched", file: "apps/gateway/src/a.ts", matchedCount: 1 },
        { kind: "no-matches", file: "apps/gateway/src/b.ts" },
        { kind: "no-matches", file: "apps/gateway/src/c.ts" },
      ],
    },
  ]);
});

test("a fully-clean file-scoped carve-out shows every file no-matches", () => {
  const report = reportWithScanned({
    violations: [],
    scannedFiles: [
      "/repo/apps/gateway/src/a.ts",
      "/repo/apps/gateway/src/b.ts",
    ],
  });
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [
      {
        service: "@rin/gateway",
        cdCode: "CD-7",
        spec: "061",
        files: ["apps/gateway/src/a.ts", "apps/gateway/src/b.ts"],
      },
    ],
  });
  const applied = result.applied[0];
  expect(applied).toEqual({
    kind: "file-scoped",
    carveOut: {
      service: "@rin/gateway",
      cdCode: "CD-7",
      spec: "061",
      files: ["apps/gateway/src/a.ts", "apps/gateway/src/b.ts"],
    },
    suppressedCount: 0,
    fileMatches: [
      { kind: "no-matches", file: "apps/gateway/src/a.ts" },
      { kind: "no-matches", file: "apps/gateway/src/b.ts" },
    ],
  });
});

test("a file-scoped carve-out where every file fires shows every file matched", () => {
  const report = reportWithScanned({
    violations: [
      violation({
        rule: "CD-7 (categorical)",
        file: "/repo/apps/gateway/src/a.ts",
      }),
      violation({
        rule: "CD-7 (categorical)",
        file: "/repo/apps/gateway/src/b.ts",
      }),
    ],
    scannedFiles: [
      "/repo/apps/gateway/src/a.ts",
      "/repo/apps/gateway/src/b.ts",
    ],
  });
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [
      {
        service: "@rin/gateway",
        cdCode: "CD-7",
        spec: "061",
        files: ["apps/gateway/src/a.ts", "apps/gateway/src/b.ts"],
      },
    ],
  });
  const applied = result.applied[0];
  expect(applied).toEqual({
    kind: "file-scoped",
    carveOut: {
      service: "@rin/gateway",
      cdCode: "CD-7",
      spec: "061",
      files: ["apps/gateway/src/a.ts", "apps/gateway/src/b.ts"],
    },
    suppressedCount: 2,
    fileMatches: [
      { kind: "matched", file: "apps/gateway/src/a.ts", matchedCount: 1 },
      { kind: "matched", file: "apps/gateway/src/b.ts", matchedCount: 1 },
    ],
  });
});

test("a listed file absent from scannedFiles is not-scanned, distinct from no-matches", () => {
  const report = reportWithScanned({
    violations: [],
    scannedFiles: ["/repo/apps/gateway/src/a.ts"],
  });
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [
      {
        service: "@rin/gateway",
        cdCode: "CD-7",
        spec: "061",
        files: ["apps/gateway/src/a.ts", "apps/gateway/src/gone.ts"],
      },
    ],
  });
  const applied = result.applied[0];
  expect(applied).toEqual({
    kind: "file-scoped",
    carveOut: {
      service: "@rin/gateway",
      cdCode: "CD-7",
      spec: "061",
      files: ["apps/gateway/src/a.ts", "apps/gateway/src/gone.ts"],
    },
    suppressedCount: 0,
    fileMatches: [
      { kind: "no-matches", file: "apps/gateway/src/a.ts" },
      { kind: "not-scanned", file: "apps/gateway/src/gone.ts" },
    ],
  });
});

test("a carve-out that suppresses nothing is reported as stale", () => {
  const report = reportOf([
    violation({ rule: "CD-2 (cast)", file: "/repo/a.ts" }),
  ]);
  const staleCarveOut: CarveOut = {
    service: "@rin/gateway",
    cdCode: "CD-6",
    spec: "060",
  };
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [staleCarveOut],
  });
  expect(result.staleCarveOuts).toEqual([staleCarveOut]);
});

test("a firing carve-out is not reported as stale", () => {
  const report = reportOf([
    violation({ rule: "CD-6 (banned name)", file: "/repo/a.ts" }),
  ]);
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [{ service: "@rin/gateway", cdCode: "CD-6", spec: "060" }],
  });
  expect(result.staleCarveOuts).toEqual([]);
});

test("report service and scannedFiles pass through unchanged", () => {
  const report = reportOf([
    violation({ rule: "CD-6 (banned name)", file: "/repo/a.ts" }),
  ]);
  const result = applyCarveOuts({
    serviceName: "@rin/gateway",
    report,
    carveOuts: [{ service: "@rin/gateway", cdCode: "CD-6", spec: "060" }],
  });
  expect(result.report.service).toBe(SERVICE);
  expect(result.report.scannedFiles).toEqual(report.scannedFiles);
});
