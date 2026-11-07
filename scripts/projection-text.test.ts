import { expect, test } from "bun:test";
import { substituteAuthoredTokens, substituteInvocationTokens, type InvocationTextBinding } from "./projection-text.ts";

const COPY: InvocationTextBinding = Object.freeze({ invoke: "bun .claude/tools/aidlc.ts", toolPrefix: "bun .claude/tools/", trustedNamespace: "engine" });
const NATIVE: InvocationTextBinding = Object.freeze({ invoke: "aidlc", toolPrefix: "aidlc engine ", trustedNamespace: "engine" });

const INVOCATION_CASES: readonly { name: string; source: string; binding: InvocationTextBinding; expected: string }[] = [
  { name: "copy invocation", source: "{{INVOKE}} next; {{TOOL_PREFIX}}state.ts; {{TRUSTED_NAMESPACE}}", binding: COPY, expected: "bun .claude/tools/aidlc.ts next; bun .claude/tools/state.ts; engine" },
  { name: "explicit native binding", source: "{{INVOKE}} next; {{TOOL_PREFIX}}state; {{TRUSTED_NAMESPACE}}", binding: NATIVE, expected: "aidlc next; aidlc engine state; engine" },
  { name: "repeated tokens", source: "{{INVOKE}} {{INVOKE}} {{TOOL_PREFIX}}{{TOOL_PREFIX}}{{TRUSTED_NAMESPACE}}{{TRUSTED_NAMESPACE}}", binding: COPY, expected: "bun .claude/tools/aidlc.ts bun .claude/tools/aidlc.ts bun .claude/tools/bun .claude/tools/engineengine" },
  { name: "unrelated text", source: "read file\r\n", binding: COPY, expected: "read file\r\n" },
  { name: "unknown or malformed tokens", source: "{{OTHER}} {{invoke}} {INVOKE} {{INVOKE }}", binding: COPY, expected: "{{OTHER}} {{invoke}} {INVOKE} {{INVOKE }}" },
  { name: "authored-only tokens untouched", source: "{{HARNESS_DIR}} {{OPTION_LETTERS}}", binding: COPY, expected: "{{HARNESS_DIR}} {{OPTION_LETTERS}}" },
  { name: "custom binding is authoritative", source: "{{INVOKE}} {{TOOL_PREFIX}} {{TRUSTED_NAMESPACE}}", binding: { invoke: "my-wrapper", toolPrefix: "chosen-prefix", trustedNamespace: "my-route" }, expected: "my-wrapper chosen-prefix my-route" },
  { name: "native invocation does not infer a prefix", source: "{{INVOKE}} {{TOOL_PREFIX}}", binding: { invoke: "aidlc", toolPrefix: "explicit custom prefix ", trustedNamespace: "custom" }, expected: "aidlc explicit custom prefix " },
  { name: "later token inserted by invocation is processed", source: "{{INVOKE}}", binding: { invoke: "{{TOOL_PREFIX}}", toolPrefix: "{{TRUSTED_NAMESPACE}}", trustedNamespace: "done" }, expected: "done" },
  { name: "earlier token inserted by prefix stays", source: "{{TOOL_PREFIX}}", binding: { invoke: "run", toolPrefix: "{{INVOKE}}", trustedNamespace: "route" }, expected: "{{INVOKE}}" },
  { name: "dollar replacement behavior", source: "{{INVOKE}}", binding: { invoke: "$&", toolPrefix: "tools/", trustedNamespace: "route" }, expected: "{{INVOKE}}" },
  { name: "empty text", source: "", binding: COPY, expected: "" },
];

test.each([...INVOCATION_CASES])("runtime binding substitution: $name", ({ source, binding, expected }) => {
  expect(substituteInvocationTokens({ source, binding })).toBe(expected);
});

const AUTHORED_CASES: readonly { name: string; request: Parameters<typeof substituteAuthoredTokens>[0]; expected: string }[] = [
  { name: "authored copy context", request: { source: "{{HARNESS_DIR}} {{OPTION_LETTERS}} {{INVOKE}}", harnessDir: ".claude", letters: "A-D", binding: COPY }, expected: ".claude A-D bun .claude/tools/aidlc.ts" },
  { name: "authored native context", request: { source: "{{HARNESS_DIR}} {{OPTION_LETTERS}} {{INVOKE}}", harnessDir: ".codex", letters: "A-C", binding: NATIVE }, expected: ".codex A-C aidlc" },
  { name: "omitted letters stay unresolved", request: { source: "{{OPTION_LETTERS}} {{HARNESS_DIR}}", harnessDir: ".claude", binding: COPY }, expected: "{{OPTION_LETTERS}} .claude" },
  { name: "explicit undefined letters stay unresolved", request: { source: "{{OPTION_LETTERS}}", harnessDir: ".claude", letters: undefined, binding: COPY }, expected: "{{OPTION_LETTERS}}" },
  { name: "empty letters replace", request: { source: "[{{OPTION_LETTERS}}]", harnessDir: ".claude", letters: "", binding: COPY }, expected: "[]" },
  { name: "repeated authored tokens", request: { source: "{{HARNESS_DIR}}/{{HARNESS_DIR}} {{OPTION_LETTERS}} {{OPTION_LETTERS}}", harnessDir: ".cursor", letters: "A-B", binding: COPY }, expected: ".cursor/.cursor A-B A-B" },
  { name: "complete sequential replacement order", request: { source: "{{OPTION_LETTERS}}", harnessDir: "{{INVOKE}}", letters: "{{HARNESS_DIR}}", binding: { invoke: "{{TOOL_PREFIX}}", toolPrefix: "{{TRUSTED_NAMESPACE}}", trustedNamespace: "ordered" } }, expected: "ordered" },
  { name: "harness replacement does not rerun letters", request: { source: "{{HARNESS_DIR}}", harnessDir: "{{OPTION_LETTERS}}", letters: "A-E", binding: COPY }, expected: "{{OPTION_LETTERS}}" },
  { name: "no unrequested normalization", request: { source: `{{HARNESS_DIR}}\r\n\${CONTEXT7_API_KEY} {{UNKNOWN}}`, harnessDir: "custom/../dir", binding: COPY }, expected: `custom/../dir\r\n\${CONTEXT7_API_KEY} {{UNKNOWN}}` },
  { name: "literal replacement dollar semantics", request: { source: "{{HARNESS_DIR}} {{OPTION_LETTERS}}", harnessDir: "$&", letters: "$&", binding: COPY }, expected: "{{HARNESS_DIR}} {{OPTION_LETTERS}}" },
];

test.each([...AUTHORED_CASES])("authored binding substitution: $name", ({ request, expected }) => {
  expect(substituteAuthoredTokens(request)).toBe(expected);
});

test("frozen binding remains unchanged", () => {
  expect(substituteInvocationTokens({ source: "{{INVOKE}}", binding: COPY })).toBe("bun .claude/tools/aidlc.ts");
  expect(COPY).toEqual({ invoke: "bun .claude/tools/aidlc.ts", toolPrefix: "bun .claude/tools/", trustedNamespace: "engine" });
});
