import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { auditCastExpressions } from "./audit-cast-expressions.js";
import type { ServiceAuditConfig } from "./audit-constitution.js";

const here = (): string => resolve(fileURLToPath(import.meta.url), "..");

const fixturePath = (scenarioDir: string): string =>
  resolve(here(), "..", "test-fixtures", "cast-expressions", scenarioDir);

const NO_DIR = resolve(here(), "this-path-does-not-exist");

const fixtureService = (scenarioDir: string): ServiceAuditConfig => ({
  name: "@rin/cast-expressions-fixture",
  srcRoot: fixturePath(scenarioDir),
  scriptsRoot: NO_DIR,
  uiSrcRoot: NO_DIR,
});

test("passing fixture reports zero cast-expression violations", () => {
  const report = auditCastExpressions({ service: fixtureService("passing") });
  expect(report.violations).toEqual([]);
});

test("arbitrary-cast fixture flags `rawText as Category` as CD-2 violation", () => {
  const report = auditCastExpressions({
    service: fixtureService("violating-arbitrary-cast"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-2"),
        snippet: expect.stringContaining("rawText as Category"),
      }),
    ]),
  );
});

test("json-cast fixture flags `parsed as T` (generic JSON narrow) as CD-2 violation", () => {
  const report = auditCastExpressions({
    service: fixtureService("violating-json-cast"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-2"),
        snippet: expect.stringContaining("parsed as T"),
      }),
    ]),
  );
});

test("error-narrowing fixture flags `caught as NodeJS.ErrnoException` as CD-2 violation", () => {
  const report = auditCastExpressions({
    service: fixtureService("violating-error-narrowing"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-2"),
        snippet: expect.stringContaining("caught as NodeJS.ErrnoException"),
      }),
    ]),
  );
});

test("report carries the supplied service config through to the result", () => {
  const report = auditCastExpressions({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/cast-expressions-fixture");
});

test("locally-declared `Zod`-prefixed type does not earn the zod introspection exemption", () => {
  const report = auditCastExpressions({
    service: fixtureService("violating-local-zod-name"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-2"),
        snippet: expect.stringContaining("schema as ZodInternalCarrier"),
      }),
    ]),
  );
});
