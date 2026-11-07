import "./projection/support/projection-currency-cases.test.ts";
import { projectionCurrencyCases } from "./projection/support/projection-currency-cases.ts";
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { packageInputsFingerprint } from "../../scripts/package-sources.ts";
import { usesCleanClaudeCopy } from "../../scripts/projection-process.ts";

const qualified = { name: "claude", harnessDir: ".claude", invoke: "bun .claude/tools/aidlc.ts", environmentCap: null, buildVersion: "2.11.3", sourceVersion: "2.11.3" } as const;
test("default Claude copy uses the retained component", () => expect(usesCleanClaudeCopy(qualified)).toBe(true));
test.each([
  { name: "cursor" }, { harnessDir: ".custom" }, { invoke: "aidlc" },
])("unqualified profile retains its named legacy route: %j", (change) => expect(usesCleanClaudeCopy({ ...qualified, ...change })).toBe(false));

const repo = join(import.meta.dir, "../..");
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [relative(repo, join(directory, entry.name)).replaceAll("\\", "/")]);
}
const inventory = projectionCurrencyCases({ paths: files(join(repo, "scripts/projection")) });
const inputs = ["package.json", "bun.lock", "scripts/project-claude.ts", "scripts/projection-process.ts", ...inventory.sources];
const root = mkdtempSync(join(tmpdir(), "clean-projection-inputs-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
test.each(inputs)("retained producer input invalidates the fingerprint: %s", (path) => {
  const fixture = join(root, path.replaceAll("/", "_"));
  const input = join(fixture, path);
  mkdirSync(dirname(input), { recursive: true });
  writeFileSync(input, "first");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(input, "second");
  expect(packageInputsFingerprint(fixture)).not.toBe(before);
});
test("retained test support remains outside production source inputs", () => {
  const fixture = join(root, "test-only");
  const input = join(fixture, "tests/unit/projection/support/example.ts");
  mkdirSync(dirname(input), { recursive: true });
  writeFileSync(input, "first");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(input, "second");
  expect(packageInputsFingerprint(fixture)).toBe(before);
});

test.each([...inventory.tests])("co-located projection test changes leave package currency unchanged: %s", (path) => {
  const fixture = mkdtempSync(join(root, "colocated-test-"));
  const input = join(fixture, path);
  mkdirSync(dirname(input), { recursive: true });
  writeFileSync(input, "first");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(input, "second");
  expect(packageInputsFingerprint(fixture)).toBe(before);
});

test.each([
  "scripts/projection/src/domain/fixture.ts",
  "scripts/projection/src/application/fixture.ts",
  "scripts/projection/src/domain/fixture.checks.ts",
  "scripts/projection/src/domain/fixture.spec.ts",
  "scripts/projection/src/domain/fixture.test.ts.backup",
])("other projection sources still invalidate package currency: %s", (path) => {
  const fixture = mkdtempSync(join(root, "projection-source-"));
  const input = join(fixture, path);
  mkdirSync(dirname(input), { recursive: true });
  writeFileSync(input, "first");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(input, "second");
  expect(packageInputsFingerprint(fixture)).not.toBe(before);
});
