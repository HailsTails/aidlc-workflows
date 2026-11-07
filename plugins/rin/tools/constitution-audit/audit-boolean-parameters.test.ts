import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { auditBooleanParameters } from "./audit-boolean-parameters.js";
import type { ServiceAuditConfig } from "./audit-constitution.js";

const here = (): string => resolve(fileURLToPath(import.meta.url), "..");

const fixturePath = (scenarioDir: string): string =>
  resolve(here(), "..", "test-fixtures", "boolean-parameters", scenarioDir);

const NO_DIR = resolve(here(), "this-path-does-not-exist");

const fixtureService = (scenarioDir: string): ServiceAuditConfig => ({
  name: "@rin/boolean-parameters-fixture",
  srcRoot: fixturePath(scenarioDir),
  scriptsRoot: NO_DIR,
  uiSrcRoot: NO_DIR,
});

test("passing fixture (discriminated union + string union + type predicate + inferred local) reports zero violations", () => {
  const report = auditBooleanParameters({ service: fixtureService("passing") });
  expect(report.violations).toEqual([]);
});

test("violating-direct fixture flags bare `boolean` parameter as CD-43 violation", () => {
  const report = auditBooleanParameters({
    service: fixtureService("violating-direct"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-43 (boolean parameter"),
        snippet: expect.stringContaining("shouldForce: boolean"),
      }),
    ]),
  );
});

test("violating-optional fixture flags `boolean | undefined` parameter as CD-43 violation", () => {
  const report = auditBooleanParameters({
    service: fixtureService("violating-optional"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-43 (boolean parameter"),
        snippet: expect.stringContaining("shouldForce: boolean | undefined"),
      }),
    ]),
  );
});

test("violating-type-field fixture flags `shouldIncludeArchived: boolean` field as CD-43 violation", () => {
  const report = auditBooleanParameters({
    service: fixtureService("violating-type-field"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-43 (boolean type field"),
        snippet: expect.stringContaining("shouldIncludeArchived: boolean"),
      }),
    ]),
  );
});

test("violating-return-type fixture flags boolean return type as CD-43 violation", () => {
  const report = auditBooleanParameters({
    service: fixtureService("violating-return-type"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-43 (boolean function return"),
      }),
    ]),
  );
});

test("report carries the supplied service config through to the result", () => {
  const report = auditBooleanParameters({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/boolean-parameters-fixture");
});
