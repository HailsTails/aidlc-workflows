import { describe, expect, test } from "bun:test";
import type { Accepted } from "../../kernel/result.ts";
import { stageNumber } from "./stage-graph.ts";

describe("stageNumber", () => {
  test.each([
    { shape: "an initialization stage", raw: "0.1" },
    { shape: "an inception stage", raw: "2.3" },
    { shape: "a stage numbered past nine", raw: "3.10" },
    { shape: "an operation stage", raw: "4.7" },
  ])("accepts $shape", ({ raw }) => {
    expect(stageNumber(raw)).toEqual<Accepted<string>>({ ok: true, value: raw });
  });

  test.each([
    { shape: "a phase past operation", raw: "5.1" },
    { shape: "a phase alone", raw: "2" },
    { shape: "a third level", raw: "2.3.1" },
    { shape: "a leading letter", raw: "v2.3" },
    { shape: "a plugin's fractional number", raw: "3.85.1" },
    { shape: "an empty number", raw: "" },
  ])("refuses $shape", ({ raw }) => {
    expect(stageNumber(raw)).toEqual({
      ok: false,
      refusal: { kind: "invalid-identity", identity: "stage", raw },
    });
  });
});
