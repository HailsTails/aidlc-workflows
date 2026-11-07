import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type { ServiceAuditConfig } from "./audit-constitution.js";
import { auditTestDiscipline } from "./audit-test-discipline.js";

const here = (): string => resolve(fileURLToPath(import.meta.url), "..");

const fixturePath = (scenarioDir: string): string =>
  resolve(here(), "..", "test-fixtures", "test-discipline", scenarioDir);

const NO_DIR = resolve(here(), "this-path-does-not-exist");

const fixtureService = (scenarioDir: string): ServiceAuditConfig => ({
  name: "@rin/test-discipline-fixture",
  srcRoot: fixturePath(scenarioDir),
  scriptsRoot: NO_DIR,
  uiSrcRoot: NO_DIR,
});

test("passing fixture reports zero test-discipline violations", () => {
  const report = auditTestDiscipline({ service: fixtureService("passing") });
  expect(report.violations).toEqual([]);
});

test("array-method fixture flags `.map` call as CD-27 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-array-method"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "CD-27 (no `.map` dynamic operation in tests — use hardcoded data)",
      }),
    ]),
  );
});

test("join fixture flags `.join` call as CD-27 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-join"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "CD-27 (no `.join` dynamic operation in tests — use hardcoded data)",
      }),
    ]),
  );
});

test("mutation fixture flags `.push` call as CD-27 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-mutation"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "CD-27 (no `.push` mutation in tests)",
      }),
    ]),
  );
});

test("vi.mock fixture flags `vi.mock(` call as CD-26 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-vi-mock"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "CD-26 (no `vi.mock` — DI is wrong; inject the port)",
      }),
    ]),
  );
});

test("mockImplementation fixture flags `.mockImplementation(` call as CD-25/27 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-mock-impl"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "CD-25/27 (no `.mockImplementation` — use `mockReturnValue`/`mockResolvedValue`/`mockReturnValueOnce`)",
      }),
    ]),
  );
});

test("vi.fn-impl fixture flags `vi.fn(<impl>)` argument as CD-25/27 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-vi-fn-impl"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "CD-25/27 (no implementation arg to `vi.fn` — use `mockReturnValue`/`mockResolvedValue`/`mockReturnValueOnce`)",
      }),
    ]),
  );
});

test("violating-if fixture flags `if` statement as CD-27 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-if"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rule: "CD-27 (no `if` in tests)" }),
    ]),
  );
});

test("violating-throw fixture flags `throw` statement as CD-10 violation", () => {
  const report = auditTestDiscipline({
    service: fixtureService("violating-throw"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: "CD-10 (no `throw` in tests — use vitest matchers)",
      }),
    ]),
  );
});

test("report carries the supplied service config through to the result", () => {
  const report = auditTestDiscipline({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/test-discipline-fixture");
});
