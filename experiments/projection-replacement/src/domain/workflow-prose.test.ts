import { expect, test } from "bun:test";
import { renderWorkflowProse } from "./workflow-prose.ts";
import { scopeContext } from "../../__tests__/scope-fixtures.ts";
test("shared workflow prose preserves unrelated rule paths and native permission references", () => {
  expect(renderWorkflowProse({ markdown: "{{HARNESS_DIR}}/rules/check.md .codex/rules/default.rules other/rules/x.md {{INVOKE}}", context: { harness: "codex", directory: ".codex", rulesSubdir: "aidlc-rules", invocation: "bun .codex/tools/aidlc.ts" }, subject: "stage" })).toEqual({ status: "ok", value: ".codex/aidlc-rules/check.md .codex/rules/default.rules other/rules/x.md bun .codex/tools/aidlc.ts" });
});
test("blank invocation fails with actionable producer guidance", () => {
  expect(renderWorkflowProse({ markdown: "Text", context: { ...scopeContext, invocation: " " }, subject: "stage" })).toEqual({ status: "invalid", findings: [{ code: "invalid-invocation", subject: "stage", detail: "authored workflow prose requires the producer's native invocation" }] });
});
test("question lettering is filled only from explicit authoring context", () => {
  expect(renderWorkflowProse({ markdown: "Include {{OPTION_LETTERS}} plus X. Other", context: { ...scopeContext, optionLetters: "A-C" }, subject: "stage" })).toEqual({ status: "ok", value: "Include A-C plus X. Other" });
});
test("unavailable question context keeps the residue refusal active", () => {
  expect(renderWorkflowProse({ markdown: "{{OPTION_LETTERS}}", context: scopeContext, subject: "stage" })).toEqual({ status: "invalid", findings: [{ code: "unresolved-token", subject: "stage", detail: "{{OPTION_LETTERS}} at line 1" }] });
});
