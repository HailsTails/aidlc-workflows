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
  { environmentCap: "balanced" }, { buildVersion: "2.11.4-preview.1" },
])("unqualified profile retains its named legacy route: %j", (change) => expect(usesCleanClaudeCopy({ ...qualified, ...change })).toBe(false));

const repo = join(import.meta.dir, "../..");
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [relative(repo, join(directory, entry.name)).replaceAll("\\", "/")]);
}
const inputs = ["package.json", "bun.lock", "scripts/project-claude.ts", "scripts/projection-process.ts", ...files(join(repo, "scripts/projection"))];
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
