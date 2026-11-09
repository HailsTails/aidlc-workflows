import { describe, expect, test } from "bun:test";
import { casesFromJunit, caseShards, distinguishingPatterns } from "./case-split.ts";

const NAMES = ["a case", "a case with more", "b other", "b ordinary", "c.dot"];

const matching = (name: string, patterns: readonly string[]): number =>
  patterns.filter((pattern) => new RegExp(pattern).test(name)).length;

describe("distinguishingPatterns", () => {
  const patterns = [...distinguishingPatterns(NAMES).values()];

  test("every recorded name matches exactly one pattern", () => {
    expect(NAMES.map((name) => matching(name, patterns))).toEqual(NAMES.map(() => 1));
  });

  test("a name that begins another is matched exactly, not by prefix", () => {
    expect(distinguishingPatterns(NAMES).get("a case")).toBe("^a case$");
  });

  test("a name unseen before matches at most one pattern, the one whose prefix it shares", () => {
    const unseen = ["a case with more words", "b orange", "zzz", "c.dot again", "cxdot"];

    expect(unseen.map((name) => matching(name, patterns))).toEqual([1, 1, 0, 1, 1]);
  });

  test("special characters are escaped", () => {
    expect(distinguishingPatterns(["x (y)"]).get("x (y)")).toBe("^x");
  });
});

describe("caseShards", () => {
  const cases = [
    { name: "slow one", seconds: 100 },
    { name: "slow two", seconds: 90 },
    { name: "fast three", seconds: 5 },
    { name: "fast four", seconds: 5 },
  ];

  test("cases are balanced into shards of about the target and one catch-all follows", () => {
    const shards = caseShards({ cases, targetSeconds: 100 });

    expect(shards.map(({ weight }) => weight)).toEqual([100, 100, 0]);
  });

  test("every case lands in exactly one shard and a new one only in the catch-all", () => {
    const shards = caseShards({ cases, targetSeconds: 100 });
    const names = [...cases.map(({ name }) => name), "brand new case"];

    const owners = names.map((name) => matching(name, shards.map(({ pattern }) => pattern)));

    expect(owners).toEqual([1, 1, 1, 1, 1]);
    expect(matching("brand new case", [shards.at(-1)?.pattern ?? ""])).toBe(1);
  });

  test("no cases means no shards", () => {
    expect(caseShards({ cases: [], targetSeconds: 100 })).toEqual([]);
  });
});

const JUNIT = [
  '<testsuite name="file.test.ts">',
  '<testcase name="plain" classname="outer" time="1.5" file="f" line="3" />',
  '<testcase name="a &gt; b &amp; &apos;c&apos;" classname="outer &gt; inner" time="0.25">',
  "</testcase>",
  '<testcase name="top" classname="" time="2"/>',
  "</testsuite>",
].join("\n");

describe("casesFromJunit", () => {
  test("it reads the full name and seconds of each case, decoding entities", () => {
    expect(casesFromJunit(JUNIT)).toEqual([
      { name: "outer plain", seconds: 1.5 },
      { name: "outer inner a > b & 'c'", seconds: 0.25 },
      { name: "top", seconds: 2 },
    ]);
  });
});
