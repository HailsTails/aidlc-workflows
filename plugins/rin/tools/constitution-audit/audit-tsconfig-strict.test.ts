import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type { ServiceAuditConfig } from "./audit-constitution.js";
import { auditTsconfigStrict } from "./audit-tsconfig-strict.js";

const here = (): string => resolve(fileURLToPath(import.meta.url), "..");

const fixturePath = (scenarioDir: string): string =>
  resolve(here(), "..", "test-fixtures", "tsconfig-strict", scenarioDir);

const NO_DIR = resolve(here(), "this-path-does-not-exist");

const fixtureService = (scenarioDir: string): ServiceAuditConfig => ({
  name: "@rin/tsconfig-strict-fixture",
  srcRoot: resolve(fixturePath(scenarioDir), "src"),
  scriptsRoot: NO_DIR,
  uiSrcRoot: NO_DIR,
});

test("passing fixture (no strict flags in compilerOptions) reports zero violations", () => {
  const report = auditTsconfigStrict({ service: fixtureService("passing") });
  expect(report.violations).toEqual([]);
});

test("violating-strict-redundant fixture flags `strict: true` override as CD-3 violation", () => {
  const report = auditTsconfigStrict({
    service: fixtureService("violating-strict-redundant"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-3 (strict-mode flag `strict`"),
        snippet: expect.stringContaining("compilerOptions.strict = true"),
      }),
    ]),
  );
});

test("violating-downgrade fixture flags `noUncheckedIndexedAccess: false` as CD-3 violation", () => {
  const report = auditTsconfigStrict({
    service: fixtureService("violating-downgrade"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining(
          "CD-3 (strict-mode flag `noUncheckedIndexedAccess`",
        ),
        snippet: expect.stringContaining(
          "compilerOptions.noUncheckedIndexedAccess = false",
        ),
      }),
    ]),
  );
});

test("violating-downgrade fixture also flags `exactOptionalPropertyTypes: false` as CD-3 violation", () => {
  const report = auditTsconfigStrict({
    service: fixtureService("violating-downgrade"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining(
          "CD-3 (strict-mode flag `exactOptionalPropertyTypes`",
        ),
      }),
    ]),
  );
});

test("report carries the supplied service config through to the result", () => {
  const report = auditTsconfigStrict({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/tsconfig-strict-fixture");
});
