import { defaultPathOperations } from "../rin-harness-path-operations.ts";
import { expect, test, vi } from "vitest";
import {
  auditConstitution,
  formatReport,
  SELF_AUDIT_EXCLUDED_FILENAMES,
  type ServiceAuditConfig,
  selfAuditExemptionOf,
} from "./audit-constitution.js";

const paths = defaultPathOperations();
const here = (): string =>
  paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) });

const fixturePath = (subdir: string): string =>
  paths.resolve({ segments: [here(), "..", "test-fixtures", "audit", subdir] });

const NO_DIR = paths.resolve({ segments: [here(), "this-path-does-not-exist"] });

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
  const report = auditConstitution({ service: fixtureService("violating-class") });
  expect(report.violations).toMatchObject([
    { rule: "CD-14", line: 1, snippet: "export class HasClass {" },
  ]);
});

test("violating-banned-import fixture reports CD-19 winston import violation", () => {
  const report = auditConstitution({ service: fixtureService("violating-banned-import") });
  expect(report.violations).toMatchObject([
    { rule: "CD-19", line: 1, snippet: "banned third-party import: winston — use its recorded wrapping boundary" },
  ]);
});

test("an unrecorded type-only ESLint boundary reports CD-19", () => {
  const report = auditConstitution({ service: fixtureService("violating-eslint-type-import") });
  expect(report.violations).toMatchObject([
    { rule: "CD-19", line: 1, snippet: "banned third-party import: eslint — use its recorded wrapping boundary" },
  ]);
});

test("orphan-no-test fixture reports CD-23/24 missing-sibling violation", () => {
  const report = auditConstitution({ service: fixtureService("orphan-no-test") });
  expect(report.violations).toMatchObject([
    { rule: "CD-23/24", line: 0, snippet: "missing co-located *.test.ts(x) sibling" },
  ]);
});

test("a module whose export list leads with a type specifier but names a runtime value still needs a sibling", () => {
  const report = auditConstitution({ service: fixtureService("orphan-mixed-export-list") });
  expect(report.violations).toMatchObject([
    {
      rule: "CD-23/24",
      file: expect.stringMatching(/[/\\]orphan-mixed-export-list[/\\]mixed-export-list\.ts$/),
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
  const report = auditConstitution({ service: fixtureService("violating-bare-date") });
  expect(report.violations).toMatchObject([
    { rule: "CD-17", line: 1, snippet: "export const stampNow = (): number => new Date().getTime();" },
  ]);
});

test("report carries the supplied service config through to the result", () => {
  const report = auditConstitution({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/test-fixture");
});

test("formatReport on a passing report emits a single PASS line + zero-violations summary", () => {
  const cwdRelativeFrom = vi.fn<(filePath: string) => string>().mockReturnValue("fixture.ts");
  const formatted = formatReport({
    report: {
      service: { name: "@rin/test-fixture", srcRoot: "/src", scriptsRoot: "/scripts", uiSrcRoot: "/ui" },
      violations: [],
      scannedFiles: ["/src/fixture.ts"],
    },
    cwdRelativeFrom,
  });
  expect(formatted).toBe("@rin/test-fixture constitution audit: PASS\n- 0 violations across 1 scanned file(s)");
  expect(cwdRelativeFrom).not.toHaveBeenCalled();
});

test("formatReport on a failing report emits FAIL + per-violation lines through the supplied path formatter", () => {
  const cwdRelativeFrom = vi.fn<(filePath: string) => string>().mockReturnValue("<rel>fixture.ts");
  const formatted = formatReport({
    report: {
      service: { name: "@rin/test-fixture", srcRoot: "/src", scriptsRoot: "/scripts", uiSrcRoot: "/ui" },
      violations: [{ rule: "CD-14", file: "/src/fixture.ts", line: 7, snippet: "class Internal {}" }],
      scannedFiles: ["/src/fixture.ts"],
    },
    cwdRelativeFrom,
  });
  expect(formatted).toBe("@rin/test-fixture constitution audit: FAIL\n- 1 violation(s) across 1 scanned file(s)\n  [CD-14] <rel>fixture.ts:7 — class Internal {}");
  expect(cwdRelativeFrom).toHaveBeenCalledExactlyOnceWith("/src/fixture.ts");
});

test("passing-with-tracked-annotations fixture (TODO(spec-NNN), biome-ignore (spec-NNN)) reports zero CD-5 violations", () => {
  const report = auditConstitution({
    service: fixtureService("passing-with-tracked-annotations"),
  });
  expect(report.violations).toEqual([]);
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

test("untracked linter directives in line, block, range and file forms fail CD-5", () => {
  const report = auditConstitution({ service: fixtureService("linter-directives-untracked") });
  expect(report.violations).toMatchObject([
    { rule: expect.stringContaining("CD-5"), line: 1 },
    { rule: expect.stringContaining("CD-5"), line: 2 },
    { rule: expect.stringContaining("CD-5"), line: 3 },
    { rule: expect.stringContaining("CD-5"), line: 4 },
    { rule: expect.stringContaining("CD-5"), line: 5 },
    { rule: expect.stringContaining("CD-5"), line: 6 },
    { rule: expect.stringContaining("CD-5"), line: 7 },
    { rule: expect.stringContaining("CD-5"), line: 8 },
    { rule: expect.stringContaining("CD-5"), line: 9 },
    { rule: expect.stringContaining("CD-5"), line: 10 },
    { rule: expect.stringContaining("CD-5"), line: 11 },
    { rule: expect.stringContaining("CD-5"), line: 12 },
    { rule: expect.stringContaining("CD-5"), line: 13 },
    { rule: expect.stringContaining("CD-5"), line: 14 },
    { rule: expect.stringContaining("CD-5"), line: 15 },
    { rule: expect.stringContaining("CD-5"), line: 16 },
    { rule: expect.stringContaining("CD-5"), line: 17 },
    { rule: expect.stringContaining("CD-5"), line: 18 },
    { rule: expect.stringContaining("CD-5"), line: 19 },
  ]);
});

test("a tracker in each actual directive comment satisfies only CD-5 annotation tracking", () => {
  const report = auditConstitution({ service: fixtureService("linter-directives-tracked") });
  expect(report.violations).toEqual([]);
});

test("strings are not directives and an adjacent comment's tracker cannot authorize one", () => {
  const report = auditConstitution({ service: fixtureService("linter-directives-lookalikes") });
  expect(report.violations).toMatchObject([
    { rule: expect.stringContaining("CD-5"), line: 3 },
  ]);
});
