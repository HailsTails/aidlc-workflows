import { describe, expect, test } from "bun:test";
import { skipped } from "../domain/outcome.ts";
import { runChecks, type GateCheck } from "./gate-check.ts";
import type { GateScope } from "./gate-scope.ts";
import type { Progress } from "./ports.ts";

const SCOPE = {} as GateScope;
const SILENT: Progress = { started: () => undefined, finished: () => undefined, note: () => undefined };

const sleeping = (ms: number): GateCheck => ({
  id: "tests",
  run: async () => {
    await Bun.sleep(ms);
    return skipped("tests", "slept");
  },
});

describe("check durations", () => {
  test("every outcome carries how long its check took", async () => {
    const outcomes = await runChecks({ scope: SCOPE, checks: [sleeping(30)], progress: SILENT });

    expect(outcomes[0]?.durationMs).toBeGreaterThanOrEqual(25);
  });
});
