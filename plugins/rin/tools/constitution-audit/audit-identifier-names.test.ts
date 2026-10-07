import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type { ServiceAuditConfig } from "./audit-constitution.js";
import { auditIdentifierNames } from "./audit-identifier-names.js";

const here = (): string => resolve(fileURLToPath(import.meta.url), "..");

const fixturePath = (scenarioDir: string): string =>
  resolve(here(), "..", "test-fixtures", "identifier-names", scenarioDir);

const NO_DIR = resolve(here(), "this-path-does-not-exist");

const fixtureService = (scenarioDir: string): ServiceAuditConfig => ({
  name: "@rin/identifier-names-fixture",
  srcRoot: fixturePath(scenarioDir),
  scriptsRoot: NO_DIR,
  uiSrcRoot: NO_DIR,
});

test("passing fixture with domain-prefixed compounds reports zero violations", () => {
  const report = auditIdentifierNames({ service: fixtureService("passing") });
  expect(report.violations).toEqual([]);
});

test("shorthand fixture flags bare `c` parameter as CD-6 violation", () => {
  const report = auditIdentifierNames({
    service: fixtureService("violating-shorthand"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-6 (banned shorthand name `c`"),
      }),
    ]),
  );
});

test("filler fixture flags `data` parameter as CD-6 violation", () => {
  const report = auditIdentifierNames({
    service: fixtureService("violating-filler"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-6 (banned filler name `data`"),
      }),
    ]),
  );
});

test("filler fixture flags `result` variable as CD-6 violation", () => {
  const report = auditIdentifierNames({
    service: fixtureService("violating-filler"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-6 (banned filler name `result`"),
      }),
    ]),
  );
});

test("destructured-filler fixture flags `body` binding as CD-6 violation", () => {
  const report = auditIdentifierNames({
    service: fixtureService("violating-destructured-filler"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-6 (banned filler name `body`"),
      }),
    ]),
  );
});

test("report carries the supplied service config through to the result", () => {
  const report = auditIdentifierNames({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/identifier-names-fixture");
});
