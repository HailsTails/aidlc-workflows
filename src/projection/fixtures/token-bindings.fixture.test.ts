import { describe, expect, test } from "bun:test";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";

describe("tokenBindingsFixture", () => {
  test("binds every copy-channel token from the harness folder", () => {
    expect(tokenBindingsFixture({ harnessDir: ".kiro" })).toEqual({
      ["HARNESS_DIR"]: ".kiro",
      ["INVOKE"]: "bun .kiro/tools/aidlc.ts",
      ["SKILL_INVOKE"]: null,
      ["OPTION_LETTERS"]: "A-E",
      ["TRUSTED_NAMESPACE"]: "aidlc",
      ["TOOL_PREFIX"]: "bun .kiro/tools/",
    });
  });
});
