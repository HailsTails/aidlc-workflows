import { describe, expect, test } from "bun:test";
import { fileTimings, slowestNote } from "./test-timing.ts";

const OUTPUT = [
  "=== START t1.test.ts ===",
  "(pass) a [3.00ms]",
  "Ran 1 test across 1 file. [12.50ms]",
  "=== DONE t1.test.ts (PASS) ===",
  "=== START t2.test.ts ===",
  "Ran 4 tests across 1 file. [2.50s]",
  "=== DONE t2.test.ts (PASS) ===",
  "=== START t3.test.ts ===",
  "Ran 2 tests across 1 file. [700.00ms]",
].join("\n");

describe("test file timings", () => {
  test("each file takes the total bun printed inside its own start marker", () => {
    expect(fileTimings(OUTPUT)).toEqual([
      { file: "t1.test.ts", ms: 12.5 },
      { file: "t2.test.ts", ms: 2500 },
      { file: "t3.test.ts", ms: 700 },
    ]);
  });

  test("the note lists the slowest first and stops at the count", () => {
    expect(slowestNote(fileTimings(OUTPUT), 2)).toBe(
      "slowest files: t2.test.ts 2.5s, t3.test.ts 0.7s",
    );
  });

  test("output with no file markers says nothing", () => {
    expect(slowestNote(fileTimings("Ran 3 tests across 1 file. [5.00ms]"), 10)).toBe("");
  });
});
