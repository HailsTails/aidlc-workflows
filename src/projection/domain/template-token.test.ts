import { describe, expect, test } from "bun:test";
import { TEMPLATE_TOKENS } from "./template-token.ts";

describe("TEMPLATE_TOKENS", () => {
  test("lists every token a method source may carry", () => {
    expect(TEMPLATE_TOKENS).toEqual([
      "HARNESS_DIR",
      "INVOKE",
      "SKILL_INVOKE",
      "OPTION_LETTERS",
      "TRUSTED_NAMESPACE",
      "TOOL_PREFIX",
    ]);
  });
});
