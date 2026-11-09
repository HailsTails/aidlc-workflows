import { describe, expect, test } from "bun:test";
import { skipped } from "../domain/outcome.ts";
import { runChecks, type GateCheck } from "./gate-check.ts";
import type { GateScope } from "./gate-scope.ts";
import type { Clock, Progress } from "./ports.ts";

const SCOPE = {} as GateScope;
const SILENT: Progress = {
  started: () => undefined,
  finished: () => undefined,
  note: () => undefined,
};

const advancing = (stepMs: number): Clock => {
  let now = 0;
  return {
    nowMs: () => {
      now += stepMs;
      return now;
    },
  };
};

const CHECK: GateCheck = { id: "tests", run: async () => skipped("tests", "ran") };

describe("check durations", () => {
  test("every outcome carries how long its check took on the clock", async () => {
    const outcomes = await runChecks({
      scope: SCOPE,
      checks: [CHECK, CHECK],
      progress: SILENT,
      clock: advancing(250),
    });

    expect(outcomes.map((outcome) => outcome.durationMs)).toEqual([250, 250]);
  });

  test("the progress line receives the duration", async () => {
    const seen: (number | undefined)[] = [];
    const progress: Progress = { ...SILENT, finished: (outcome) => seen.push(outcome.durationMs) };

    await runChecks({ scope: SCOPE, checks: [CHECK], progress, clock: advancing(40) });

    expect(seen).toEqual([40]);
  });
});
