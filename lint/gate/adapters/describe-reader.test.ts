import { describe, expect, test } from "bun:test";
import { topLevelDescribes } from "./describe-reader.ts";

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
