import { describe, expect, test } from "bun:test";
import { hasTestsOutsideNamedDescribes, topLevelDescribes } from "./describe-reader.ts";

const SOURCE = [
  'import { describe, test } from "bun:test";',
  'describe("first", () => { describe("nested", () => { test("a", () => {}); }); });',
  "describe(`template`, () => {});",
  'describe("second", () => {});',
  'test("outside", () => {});',
  'const inside = () => { describe("not top level", () => {}); };',
].join("\n");

describe("topLevelDescribes", () => {
  test("lists the literal names of top-level describe blocks in order", () => {
    expect(topLevelDescribes(SOURCE)).toEqual(["first", "template", "second"]);
  });

  test("a nested or non-top-level describe is not a shard", () => {
    expect(topLevelDescribes(SOURCE)).not.toContain("nested");
    expect(topLevelDescribes(SOURCE)).not.toContain("not top level");
  });
});

const TEMPLATED_DESCRIBE = ["describe(`t$", "suffix}`, () => {});"].join("{");

const ONLY_DESCRIBES = [
  'describe("a", () => { test("x", () => {}); });',
  'describe("b", () => {});',
].join("\n");

describe("hasTestsOutsideNamedDescribes", () => {
  test("a file whose tests all sit in literal-named describes has none outside", () => {
    expect(hasTestsOutsideNamedDescribes(ONLY_DESCRIBES)).toBe(false);
  });

  test("a top-level test, a loop that registers tests or a templated describe counts", () => {
    expect(hasTestsOutsideNamedDescribes('test("t", () => {});')).toBe(true);
    expect(hasTestsOutsideNamedDescribes("for (const n of ns) { test(n, () => {}); }")).toBe(true);
    expect(hasTestsOutsideNamedDescribes(TEMPLATED_DESCRIBE)).toBe(true);
    expect(hasTestsOutsideNamedDescribes('test.each([1])("t", () => {});')).toBe(true);
  });

  test("helpers that register nothing do not count", () => {
    const helper = "const x = 1;";
    expect(hasTestsOutsideNamedDescribes([helper, ONLY_DESCRIBES].join("\n"))).toBe(false);
  });
});
