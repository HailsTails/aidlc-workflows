import { describe, expect, test } from "bun:test";
import { accepted, refused } from "../result.ts";
import { accept } from "./accept.ts";

describe("accept", () => {
  test("returns the value of an accepted result", () => {
    expect(accept(accepted("ready"))).toBe("ready");
  });

  test("throws with the refusal when the result was refused", () => {
    expect(() => accept(refused({ kind: "missing", raw: "x" }))).toThrow(
      'Fixture value refused: {"kind":"missing","raw":"x"}',
    );
  });
});
