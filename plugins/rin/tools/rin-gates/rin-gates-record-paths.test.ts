import { describe, expect, test } from "vitest";
import {
  factsPathFor,
  optionsLedgerPathFor,
} from "./rin-gates-record-paths.ts";

describe("optionsLedgerPathFor", () => {
  test("places the options ledger in Gate 2's stage directory", () => {
    expect(
      optionsLedgerPathFor({
        recordDirectory: "/repo/aidlc/spaces/default/intents/260101-rec",
      }),
    ).toBe(
      "/repo/aidlc/spaces/default/intents/260101-rec/inception/rin-gate-2-plan-review/rin-solution-options.md",
    );
  });
});

describe("factsPathFor", () => {
  test("places facts.md at the record root", () => {
    expect(
      factsPathFor({
        recordDirectory: "/repo/aidlc/spaces/default/intents/260101-rec",
      }),
    ).toBe("/repo/aidlc/spaces/default/intents/260101-rec/facts.md");
  });
});
