import { describe, expect, test } from "bun:test";
import { accepted, refused } from "./result.ts";

describe("accepted", () => {
  test("wraps a value as an accepted result", () => {
    expect(accepted("ready")).toEqual({ ok: true, value: "ready" });
  });
});

describe("refused", () => {
  test("wraps a refusal as a refused result", () => {
    expect(refused({ kind: "missing" })).toEqual({ ok: false, refusal: { kind: "missing" } });
  });
});
