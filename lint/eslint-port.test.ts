import { describe, expect, test } from "bun:test";
import { Linter } from "./eslint-port.ts";

describe("eslint port", () => {
  test("the wrapped linter verifies source against a flat config", () => {
    const messages = new Linter({ configType: "flat" }).verify("debugger;", [
      { rules: { "no-debugger": "error" } },
    ]);

    expect(messages).toEqual([expect.objectContaining({ ruleId: "no-debugger", line: 1 })]);
  });
});
