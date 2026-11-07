import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageInputsFingerprint } from "./package-sources.ts";

// Component controls exercise the real finite fingerprint inventory, not a parsed list.
const root = mkdtempSync(join(tmpdir(), "producer-input-registration-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test.each([
  "projection-text", "claude-settings", "agent-surface-projection", "core-projection-contract",
  "harness-runtime-data", "harness-surface-projection", "onboarding-projection",
  "native-command-context", "native-command-text",
  "generated-skill-regions", "workspace-seed", "projection-metadata", "version-module",
  "earlier-release-regions",
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
