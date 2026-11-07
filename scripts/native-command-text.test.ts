import { expect, test } from "bun:test";
import { prepareNativeDocumentText, projectNativeCommandText } from "./native-command-text.ts";
import { createNativeCommandContext } from "./native-command-context.ts";
const context = createNativeCommandContext({ harnessDir: ".claude" });
test("projects verb-aware workspace commands before generic delegates", () => {
  expect(prepareNativeDocumentText({ source: "bun .claude/tools/aidlc-utility.ts document-input --onboard --include-ignored", context, subject: "stage.md" })).toEqual({ status: "ok", text: "aidlc engine workspace document-input --onboard --include-ignored" });
});
test("preserves line boundaries and trailing arguments", () => {
  expect(prepareNativeDocumentText({ source: "bun .claude/tools/aidlc-testing-posture.ts brief --unit\n  \"<directive.unit>\"", context, subject: "stage.md" })).toEqual({ status: "ok", text: "aidlc engine testing-posture brief --unit\n  \"<directive.unit>\"" });
});
test("retains config verb routing without editing permission data", () => {
  expect(prepareNativeDocumentText({ source: "bun .claude/tools/aidlc-utility.ts config-change --guard.plan-approval off", context, subject: "stage.md" })).toEqual({ status: "ok", text: "aidlc engine config set guard.plan-approval off" });
});
test("an unknown owned tool route is refused", () => {
  expect(prepareNativeDocumentText({ source: "bun .claude/tools/aidlc-not-a-route.ts execute", context, subject: "stage.md" })).toEqual({ status: "invalid", problems: ['stage.md:1: unresolvable projected namespace invocation "aidlc engine not-a-route execute"'] });
});
test("unrelated commands, prose and permission patterns are unchanged", () => {
  expect(projectNativeCommandText({ source: 'bun example.ts\n{"allowedCommands":["bun .claude/tools/.*"]}\n- **Permissions**: retain this authored policy', context })).toBe('bun example.ts\n{"allowedCommands":["bun .claude/tools/.*"]}\n- **Permissions**: retain this authored policy');
});
test("retains pinned upstream namespace rewriting without the fork deduplication fix", () => {
  expect(projectNativeCommandText({ source: "bun .claude/tools/aidlc.ts engine log decision", context })).toBe("aidlc engine engine log decision");
});

test("retains pinned upstream intent-create spelling without the fork routing fix", () => {
  expect(projectNativeCommandText({ source: "bun .claude/tools/aidlc-utility.ts intent-create idea", context })).toBe("aidlc engine utility intent-create idea");
});
