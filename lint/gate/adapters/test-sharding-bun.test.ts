import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describePatterns } from "../domain/test-sharding.ts";
import { topLevelDescribes } from "./describe-reader.ts";

const SCRATCH = mkdtempSync(join(import.meta.dir, "../../../.cache/gate-tests-shards-"));

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

const FIXTURE = [
  'import { describe, test } from "bun:test";',
  'describe("install", () => { test("a", () => {}); test("b", () => {}); });',
  'describe("install (extra)", () => { test("c", () => {}); });',
  'describe("guard.rails", () => { describe("inner", () => { test("d", () => {}); }); });',
  'describe("tail", () => { test("e", () => {}); });',
  'test("outside any describe", () => {});',
].join("\n");

const FIXTURE_FILE = join(SCRATCH, "fixture.test.ts");
writeFileSync(FIXTURE_FILE, FIXTURE);

const CASE_TAG = /<testcase name="([^"]*)"[^>]*? line="([0-9]+)"[^>]*[/]>/g;

const reportedCases = (report: string): readonly string[] =>
  [...readFileSync(report, "utf8").matchAll(CASE_TAG)].map(([, name, line]) => `${name}@${line}`);

const passedCases = (pattern: string | undefined): readonly string[] => {
  const report = join(SCRATCH, `report-${Math.random().toString(36).slice(2)}.xml`);
  const narrowing = pattern === undefined ? [] : ["--test-name-pattern", pattern];
  const reporting = ["--reporter=junit", `--reporter-outfile=${report}`];
  Bun.spawnSync([process.execPath, "test", FIXTURE_FILE, ...reporting, ...narrowing], {
    cwd: SCRATCH,
    stdout: "pipe",
    stderr: "pipe",
  });
  return reportedCases(report);
};

describe("describe-block shards against real bun", () => {
  const patterns = describePatterns(topLevelDescribes(FIXTURE));
  const full = passedCases(undefined);
  const shards = patterns.map((pattern) => passedCases(pattern));

  test("the fixture has every kind of case the split must handle", () => {
    expect(full).toHaveLength(6);
    expect(patterns).toHaveLength(5);
  });

  test("the shards together run every case of the file", () => {
    expect([...shards.flat()].sort()).toEqual([...full].sort());
  });

  test("no case runs in two shards", () => {
    const all = shards.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  test("red: a pattern list missing the remainder drops the unnamed case", () => {
    const withoutRemainder = patterns.slice(0, -1).flatMap((pattern) => passedCases(pattern));
    expect(withoutRemainder).not.toContain("outside any describe");
  });
});
