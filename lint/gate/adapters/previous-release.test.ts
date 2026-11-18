import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { previousRelease } from "./previous-release.ts";

const parent = join(import.meta.dir, "../../../.cache");
mkdirSync(parent, { recursive: true });
const root = mkdtempSync(join(parent, "previous-release-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const stamps = Array.from({ length: 7 }, (_, index) => `${index}.json`);
const record = JSON.stringify({
  release: "2.11.2", sourceCommit: "a".repeat(40), location: "retained/dist", stamps,
});
const request = {
  workspace: { read: () => record, write: () => undefined, filesMatching: () => [] },
  beside: (location: string) => join(root, location),
};

test("missing recorded artifact names its exact restoration location and source", () => {
  const result = previousRelease(request);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.fix).toContain(join(root, "retained/dist"));
    expect(result.fix).toContain("a".repeat(40));
  }
});

test("seven recorded release stamps resolve without a shell variable", () => {
  const location = request.beside("retained/dist");
  mkdirSync(location, { recursive: true });
  for (const stamp of stamps) {
    writeFileSync(join(location, stamp), JSON.stringify({ frameworkVersion: "2.11.2" }));
  }
  expect(previousRelease(request)).toEqual({ ok: true, value: location });
  writeFileSync(join(location, "0.json"), JSON.stringify({ frameworkVersion: "other" }));
  expect(previousRelease(request).ok).toBe(false);
});
