import { expect, test } from "bun:test";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { bindTemplateTokens } from "./token-binding.ts";

test("only selected token families are bound and nullable values stay literal", () => {
  expect(bindTemplateTokens({ text: "{{INVOKE}}|{{HARNESS_DIR}}|{{SKILL_INVOKE}}|{{UNKNOWN}}",
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }), selected: ["INVOKE", "SKILL_INVOKE"] }))
    .toBe("bun .claude/tools/aidlc.ts|{{HARNESS_DIR}}|{{SKILL_INVOKE}}|{{UNKNOWN}}");
});

test("binding retains the selected order of the existing sequential substitution", () => {
  expect(bindTemplateTokens({ text: "{{INVOKE}}", selected: ["INVOKE", "TOOL_PREFIX"],
    tokens: { ...tokenBindingsFixture({ harnessDir: ".claude" }), ["INVOKE"]: "{{TOOL_PREFIX}}next" } }))
    .toBe("bun .claude/tools/next");
});