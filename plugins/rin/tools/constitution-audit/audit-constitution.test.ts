import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  auditConstitution,
  formatReport,
  SELF_AUDIT_EXCLUDED_FILENAMES,
  type ServiceAuditConfig,
  selfAuditExemptionOf,
} from "./audit-constitution.js";

const here = (): string => resolve(fileURLToPath(import.meta.url), "..");

const fixturePath = (subdir: string): string =>
  resolve(here(), "..", "test-fixtures", "audit", subdir);

const NO_DIR = resolve(here(), "this-path-does-not-exist");

const fixtureService = (subdir: string): ServiceAuditConfig => ({
  name: "@rin/test-fixture",
  srcRoot: fixturePath(subdir),
  scriptsRoot: NO_DIR,
  uiSrcRoot: NO_DIR,
});

test("passing fixture reports zero violations", () => {
  const report = auditConstitution({ service: fixtureService("passing") });
  expect(report.violations).toEqual([]);
});

test("violating-class fixture reports CD-14 class declaration violation", () => {
  const report = auditConstitution({
    service: fixtureService("violating-class"),
  });
  const cd14Violations = report.violations.filter(
    (violation) => violation.rule === "CD-14",
  );
  expect(cd14Violations.length).toBe(1);
});

test("violating-banned-import fixture reports CD-19 winston import violation", () => {
  const report = auditConstitution({
    service: fixtureService("violating-banned-import"),
  });
  const cd19Violations = report.violations.filter(
    (violation) => violation.rule === "CD-19",
  );
  expect(cd19Violations.length).toBe(1);
});

test("orphan-no-test fixture reports CD-23/24 missing-sibling violation", () => {
  const report = auditConstitution({
    service: fixtureService("orphan-no-test"),
  });
  const ratioViolations = report.violations.filter(
    (violation) => violation.rule === "CD-23/24",
  );
  expect(ratioViolations.length).toBe(1);
});

test("a module whose export list leads with a type specifier but names a runtime value still needs a sibling", () => {
  const report = auditConstitution({
    service: fixtureService("orphan-mixed-export-list"),
  });
  expect(report.violations).toEqual([
    {
      rule: "CD-23/24",
      file: resolve(
        fixturePath("orphan-mixed-export-list"),
        "mixed-export-list.ts",
      ),
      line: 0,
      snippet: "missing co-located *.test.ts(x) sibling",
    },
  ]);
});

test("a module exporting only types needs no sibling", () => {
  const report = auditConstitution({
    service: fixtureService("type-only-no-test"),
  });
  expect(report.violations).toEqual([]);
});

test("violating-bare-date fixture reports CD-17 bare Date construction violation", () => {
  const report = auditConstitution({
    service: fixtureService("violating-bare-date"),
  });
  const cd17Violations = report.violations.filter(
    (violation) => violation.rule === "CD-17",
  );
  expect(cd17Violations.length).toBe(1);
});

test("report carries the supplied service config through to the result", () => {
  const report = auditConstitution({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/test-fixture");
});

test("formatReport on a passing report emits a single PASS line + zero-violations summary", () => {
  const report = auditConstitution({ service: fixtureService("passing") });
  const formatted = formatReport({
    report,
    cwdRelativeFrom: (filePath) => filePath,
  });
  expect(formatted).toContain("@rin/test-fixture constitution audit: PASS");
  expect(formatted).toContain("0 violations");
});

test("formatReport on a failing report emits FAIL + per-violation lines through the supplied path formatter", () => {
  const report = auditConstitution({
    service: fixtureService("violating-class"),
  });
  const formatted = formatReport({
    report,
    cwdRelativeFrom: (filePath) => `<rel>${filePath}`,
  });
  expect(formatted).toContain("@rin/test-fixture constitution audit: FAIL");
  expect(formatted).toContain("[CD-14]");
  expect(formatted).toContain("<rel>");
});

test("passing-with-tracked-annotations fixture (TODO(spec-NNN), biome-ignore (spec-NNN)) reports zero CD-5 violations", () => {
  const report = auditConstitution({
    service: fixtureService("passing-with-tracked-annotations"),
  });
  const cd5Violations = report.violations.filter((violation) =>
    violation.rule.startsWith("CD-5"),
  );
  expect(cd5Violations).toEqual([]);
});

test("violating-bare-todo fixture flags untracked `// TODO:` as CD-5 violation", () => {
  const report = auditConstitution({
    service: fixtureService("violating-bare-todo"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-5 (bare `// TODO`"),
      }),
    ]),
  );
});

test("violating-bare-biome-ignore fixture flags untracked `// biome-ignore` as CD-5 violation", () => {
  const report = auditConstitution({
    service: fixtureService("violating-bare-biome-ignore"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-5 (bare `// biome-ignore`"),
      }),
    ]),
  );
});

test("violating-bare-ts-expect-error fixture flags untracked `// @ts-expect-error` as CD-5 violation", () => {
  const report = auditConstitution({
    service: fixtureService("violating-bare-ts-expect-error"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-5 (bare `// @ts-expect-error`"),
      }),
    ]),
  );
});

test("self-exemption reports self-exempt for the excluded basename", () => {
  expect(selfAuditExemptionOf({ filePath: "audit-constitution.ts" })).toBe(
    "self-exempt",
  );
});

test("self-exemption matches on basename regardless of directory prefix", () => {
  expect(
    selfAuditExemptionOf({
      filePath: "plugins/rin/tools/constitution-audit/audit-constitution.ts",
    }),
  ).toBe("self-exempt");
});

test("self-exemption reports not-self-exempt for another walker in the same directory", () => {
  expect(
    selfAuditExemptionOf({
      filePath: "constitution-audit/audit-cast-expressions.ts",
    }),
  ).toBe("not-self-exempt");
});

test("self-exemption does not match a filename merely ending with the excluded basename", () => {
  expect(selfAuditExemptionOf({ filePath: "x-audit-constitution.ts" })).toBe(
    "not-self-exempt",
  );
});

test("the exempted basename set is exactly the audit walker's own module", () => {
  expect(SELF_AUDIT_EXCLUDED_FILENAMES).toEqual(["audit-constitution.ts"]);
});
