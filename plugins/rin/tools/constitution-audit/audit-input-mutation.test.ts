import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type { ServiceAuditConfig } from "./audit-constitution.js";
import { auditInputMutation } from "./audit-input-mutation.js";

const here = (): string => resolve(fileURLToPath(import.meta.url), "..");

const fixturePath = (scenarioDir: string): string =>
  resolve(here(), "..", "test-fixtures", "input-mutation", scenarioDir);

const NO_DIR = resolve(here(), "this-path-does-not-exist");

const fixtureService = (scenarioDir: string): ServiceAuditConfig => ({
  name: "@rin/input-mutation-fixture",
  srcRoot: fixturePath(scenarioDir),
  scriptsRoot: NO_DIR,
  uiSrcRoot: NO_DIR,
});

test("passing fixture (local mutation then return) reports zero violations", () => {
  const report = auditInputMutation({ service: fixtureService("passing") });
  expect(report.violations).toEqual([]);
});

test("violating-field-assignment fixture flags `profile.name = newName` as CD-44 violation", () => {
  const report = auditInputMutation({
    service: fixtureService("violating-field-assignment"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-44"),
        snippet: expect.stringContaining("profile.name = newName"),
      }),
    ]),
  );
});

test("violating-element-access fixture flags `numbers[0] = replacement` as CD-44 violation", () => {
  const report = auditInputMutation({
    service: fixtureService("violating-element-access"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-44"),
        snippet: expect.stringContaining("numbers[0] = replacement"),
      }),
    ]),
  );
});

test("violating-delete fixture flags `delete profile.nickname` as CD-44 violation", () => {
  const report = auditInputMutation({
    service: fixtureService("violating-delete"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-44"),
        snippet: expect.stringContaining("delete profile.nickname"),
      }),
    ]),
  );
});

test("violating-destructured fixture flags `inner.name = newName` (destructured param field mutation) as CD-44 violation", () => {
  const report = auditInputMutation({
    service: fixtureService("violating-destructured"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("CD-44"),
        snippet: expect.stringContaining("inner.name = newName"),
      }),
    ]),
  );
});

test("violating-method-push fixture flags `existingList.push(value)` as CD-44 violation", () => {
  const report = auditInputMutation({
    service: fixtureService("violating-method-push"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("mutating method `.push`"),
        snippet: expect.stringContaining("existingList.push(value)"),
      }),
    ]),
  );
});

test("violating-method-sort fixture flags `mutableList.sort()` as CD-44 violation", () => {
  const report = auditInputMutation({
    service: fixtureService("violating-method-sort"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("mutating method `.sort`"),
        snippet: expect.stringContaining("mutableList.sort()"),
      }),
    ]),
  );
});

test("violating-method-splice fixture flags `existingList.splice(start, count)` as CD-44 violation", () => {
  const report = auditInputMutation({
    service: fixtureService("violating-method-splice"),
  });
  expect(report.violations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rule: expect.stringContaining("mutating method `.splice`"),
        snippet: expect.stringContaining(
          "existingList.splice(startIndex, removeCount)",
        ),
      }),
    ]),
  );
});

test("report carries the supplied service config through to the result", () => {
  const report = auditInputMutation({ service: fixtureService("passing") });
  expect(report.service.name).toBe("@rin/input-mutation-fixture");
});
