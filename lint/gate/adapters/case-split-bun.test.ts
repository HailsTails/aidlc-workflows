import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { casesFromJunit, caseShards } from "../domain/case-split.ts";

const SCRATCH = mkdtempSync(join(import.meta.dir, "../../../.cache/gate-tests-cases-"));

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

const RECORDED_SOURCE = [
  'import { describe, test } from "bun:test";',
  'describe("install (a)", () => {',
  '  test("reads the file", () => {});',
  '  test("reads the file twice", () => {});',
  '  test("writes it > then checks", () => {});',
  "});",
  'describe("guard.rails", () => { describe("inner", () => { test("deep one", () => {}); }); });',
  'test("outside any describe", () => {});',
].join("\n");

const WITH_NEW_CASE = `${RECORDED_SOURCE}\ntest("a case added after recording", () => {});\n`;

const FILE = join(SCRATCH, "fixture.test.ts");

const EXECUTED_TAG = /<testcase [^>]*[/]>/g;

const executedNames = (pattern: string | undefined): readonly string[] => {
  const report = join(SCRATCH, `report-${Math.random().toString(36).slice(2)}.xml`);
  const narrowing = pattern === undefined ? [] : ["--test-name-pattern", pattern];
  Bun.spawnSync(
    [
      process.execPath,
      "test",
      FILE,
      "--reporter=junit",
      `--reporter-outfile=${report}`,
      ...narrowing,
    ],
    { cwd: SCRATCH, stdout: "pipe", stderr: "pipe" },
  );
  const executed = readFileSync(report, "utf8").match(EXECUTED_TAG) ?? [];
  return casesFromJunit(executed.join(String.fromCharCode(10))).map(({ name }) => name);
};

writeFileSync(FILE, RECORDED_SOURCE);
const RECORDED_RUN = readFileSync(FILE, "utf8");
const FULL = executedNames(undefined);
const SHARDS = caseShards({
  cases: FULL.map((name) => ({ name, seconds: 1 })),
  targetSeconds: 2,
});
const RESULTS = SHARDS.map(({ pattern }) => executedNames(pattern));

describe("case shards against real bun", () => {
  test("the fixture recorded every case", () => {
    expect(RECORDED_RUN).toBe(RECORDED_SOURCE);
    expect(FULL).toHaveLength(5);
    expect(SHARDS).toHaveLength(4);
  });

  test("the shards together run every recorded case, each exactly once", () => {
    expect([...RESULTS.flat()].sort()).toEqual([...FULL].sort());
  });

  test("a case added after recording runs only in the catch-all shard", () => {
    writeFileSync(FILE, WITH_NEW_CASE);

    const running = SHARDS.map(({ pattern }) => executedNames(pattern));

    expect(running.map((names) => names.includes("a case added after recording"))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(running.flat()).toHaveLength(FULL.length + 1);
  });
});
