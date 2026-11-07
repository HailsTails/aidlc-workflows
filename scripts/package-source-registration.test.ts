import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { packageInputsFingerprint } from "./package-sources.ts";
import { observeProductionInputs } from "./projection/src/adapters/source-input-contract.ts";

// Component controls exercise the real finite fingerprint inventory, not a parsed list.
const root = mkdtempSync(join(tmpdir(), "producer-input-registration-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test.each([
  "runtime-source-selection", "projection-text", "claude-settings", "agent-surface-projection", "core-projection-contract",
  "harness-runtime-data", "harness-surface-projection", "onboarding-projection",
  "native-command-context", "native-command-text",
  "generated-skill-regions", "workspace-seed", "projection-metadata-filesystem", "version-module",
  "earlier-release-regions", "plugin-authoring-catalogue",
])("producer edit invalidates package input fingerprint: %s", (name) => {
  const fixture = join(root, name);
  mkdirSync(join(fixture, "scripts"), { recursive: true });
  const file = join(fixture, "scripts", `${name}.ts`);
  writeFileSync(file, "// original producer source\n");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(file, "// changed producer source\n");
  expect(packageInputsFingerprint(fixture)).not.toBe(before);
});

test("producer tests are not production fingerprint inputs", () => {
  const fixture = join(root, "test-only");
  mkdirSync(join(fixture, "scripts"), { recursive: true });
  const file = join(fixture, "scripts", "native-command-text.test.ts");
  writeFileSync(file, "// original test\n");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(file, "// changed test\n");
  expect(packageInputsFingerprint(fixture)).toBe(before);
});

test("metadata adapter and retained owner enter the independent production witness", () => {
  const fixture = join(root, "metadata-witness");
  for (const dir of ["core", "harness", "scripts/projection/native"]) mkdirSync(join(fixture, dir), { recursive: true });
  for (const path of ["package.json", "bun.lock", "scripts/projection-metadata-filesystem.ts", "scripts/projection/native/projection-metadata.ts"]) writeFileSync(join(fixture, path), "original\n");
  const before = observeProductionInputs(fixture);
  for (const path of ["scripts/projection-metadata-filesystem.ts", "scripts/projection/native/projection-metadata.ts"]) {
    expect(before.some(input => input.path === path)).toBe(true);
    writeFileSync(join(fixture, path), "changed\n");
    expect(observeProductionInputs(fixture).find(input => input.path === path)?.sha256).not.toBe(before.find(input => input.path === path)?.sha256);
    writeFileSync(join(fixture, path), "original\n");
  }
  expect(observeProductionInputs(fixture)).toEqual(before);
});
test.each([
  "scripts/projection/src/adapters/source-runtime-modules.test.ts",
  "scripts/projection/src/domain/nested/fixture.test.ts",
  "scripts/projection/examples/fixture.test.ts",
  "core/tools/aidlc-shell.test.ts",
])("co-located test edits do not invalidate package currency: %s", (path) => {
  const fixture = mkdtempSync(join(root, "test-currency-"));
  const file = join(fixture, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "original test");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(file, "changed test");
  expect(packageInputsFingerprint(fixture)).toBe(before);
});

test.each([
  "scripts/projection/src/adapters/source-runtime-modules.ts",
  "scripts/runtime-source-selection.ts",
  "core/tools/aidlc-shell.ts",
  "harness/claude/settings.ts",
  "harness/claude/settings.test.ts",
  "scripts/plugin-hooks-template/explicit.test.ts",
])("adjacent production owner edits still invalidate package currency: %s", (path) => {
  const fixture = mkdtempSync(join(root, "owner-currency-"));
  const file = join(fixture, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "original owner");
  const before = packageInputsFingerprint(fixture);
  writeFileSync(file, "changed owner");
  expect(packageInputsFingerprint(fixture)).not.toBe(before);
});
