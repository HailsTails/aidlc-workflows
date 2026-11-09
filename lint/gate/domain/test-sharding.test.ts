import { describe, expect, test } from "bun:test";
import { assignGroups, describePatterns, escapeRegex, planItems } from "./test-sharding.ts";

const NAMES = ["install (a)", "install", "guard.rails", "x"];

const owners = (caseName: string, patterns: readonly string[]): number =>
  patterns.filter((pattern) => new RegExp(pattern).test(caseName)).length;

describe("describePatterns", () => {
  test("every case name is owned by exactly one shard", () => {
    const patterns = describePatterns(NAMES);
    const cases = [
      "install (a) first case",
      "install second",
      "install",
      "guard.rails > nested case",
      "guardXrails other",
      "x y",
      "xy not a describe",
      "a top level case outside any describe",
    ];

    expect(cases.map((name) => owners(name, patterns))).toEqual(cases.map(() => 1));
  });

  test("a case whose describe was not scanned lands in the remainder shard", () => {
    const patterns = describePatterns(NAMES);
    const remainder = patterns.at(-1) as string;

    expect(new RegExp(remainder).test("unscanned describe case")).toBe(true);
    expect(new RegExp(remainder).test("install first case")).toBe(false);
  });

  test("a file with no describes is not split", () => {
    expect(describePatterns([])).toEqual([]);
  });

  test("special characters in a describe name are matched literally", () => {
    expect(escapeRegex("a.b(c)")).toBe(["a", ".b", "(c", ")"].join(String.fromCharCode(92)));
  });
});

describe("assignGroups", () => {
  test("heaviest first onto the lightest group", () => {
    const groups = assignGroups(
      [{ weight: 5 }, { weight: 4 }, { weight: 3 }, { weight: 3 }],
      2,
    );

    const totals = groups.map((group) => group.reduce((sum, { weight }) => sum + weight, 0));
    expect(totals).toEqual([8, 7]);
  });
});

describe("planItems", () => {
  const request = {
    files: ["big.test.ts", "a.test.ts", "b.test.ts"],
    weightOf: (file: string) => (file === "big.test.ts" ? 100 : 1),
    describesOf: (file: string) => (file === "big.test.ts" ? ["one", "two"] : []),
    splitAtOrAbove: 60,
    groups: 1,
  };

  test("a big file splits per describe plus a remainder; small files share a group", () => {
    const items = planItems(request);

    expect(items.map((item) => [item.files.join("+"), item.pattern === undefined])).toEqual([
      ["big.test.ts", false],
      ["big.test.ts", false],
      ["big.test.ts", false],
      ["a.test.ts+b.test.ts", true],
    ]);
  });

  test("every input file appears in the plan", () => {
    const files = new Set(planItems(request).flatMap((item) => item.files));

    expect([...files].sort()).toEqual([...request.files].sort());
  });
});
