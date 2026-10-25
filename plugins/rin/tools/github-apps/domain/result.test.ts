import { describe, expect, it } from "vitest";
import { fail, succeed } from "./result.ts";

describe("result", () => {
  it("wraps an outcome as a success", () => {
    expect(succeed({ url: "https://github.com" })).toEqual({
      kind: "success",
      outcome: { url: "https://github.com" },
    });
  });

  it("wraps a reason as a failure", () => {
    expect(fail({ kind: "body-missing" })).toEqual({
      kind: "failure",
      reason: { kind: "body-missing" },
    });
  });
});
