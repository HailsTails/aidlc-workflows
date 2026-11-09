import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sweepLedger } from "./sweep-ledger.ts";

const SCRATCH = mkdtempSync(join(import.meta.dir, "../../../.cache/gate-tests-sweeps-"));

afterAll(() => {
  rmSync(SCRATCH, { recursive: true, force: true });
});

const ENTRY = { commit: "f2e9ef347", result: "red" as const, finishedAt: 5, durationMs: 9 };

describe("sweepLedger", () => {
  test("what is recorded for a commit is found for that commit only", () => {
    const ledger = sweepLedger(SCRATCH);

    ledger.record(ENTRY);

    expect(ledger.find("f2e9ef347")).toEqual(ENTRY);
    expect(ledger.find("0000000")).toBeUndefined();
  });

  test("an unreadable record counts as no record", () => {
    mkdirSync(join(SCRATCH, "sweeps"), { recursive: true });
    writeFileSync(join(SCRATCH, "sweeps", "broken.json"), "{ not json");

    expect(sweepLedger(SCRATCH).find("broken")).toBeUndefined();
  });
});
