import { describe, expect, test } from "bun:test";
import { budgetOf, relianceNote, relianceOn } from "./sweep.ts";

const GREEN = { commit: "abcdef0123456", result: "green" as const, finishedAt: 1, durationMs: 2 };

describe("sweep reliance", () => {
  test("a recorded sweep is named with its result", () => {
    const note = relianceNote(relianceOn(GREEN.commit, GREEN));

    expect(note).toBe("relies on the green sweep of abcdef012");
  });

  test("no record says how to make one", () => {
    expect(relianceNote(relianceOn(GREEN.commit, undefined))).toContain("run gate --full --sweep");
  });
});

describe("budgetOf", () => {
  test("a candidate has 180 seconds and a sweep 600", () => {
    expect(budgetOf({ sweep: false, tookMs: 1 }).limitMs).toBe(180_000);
    expect(budgetOf({ sweep: true, tookMs: 1 }).limitMs).toBe(600_000);
  });

  test("it is over only when the run took longer than the limit", () => {
    expect(budgetOf({ sweep: false, tookMs: 180_000 }).over).toBe(false);
    expect(budgetOf({ sweep: false, tookMs: 180_001 }).over).toBe(true);
  });
});
