import { expect, mock, test } from "bun:test";
import { substituteAuthoredTokens, type AuthoredInvocationPort } from "./authored-text.ts";

test("authored harness tokens are replaced before the isolated invocation delegate", () => {
  const substitute = mock<AuthoredInvocationPort["substitute"]>().mockReturnValue("delegated");
  expect(substituteAuthoredTokens({ source: "{{HARNESS_DIR}}/{{HARNESS_DIR}} {{OPTION_LETTERS}} {{INVOKE}} {{TOOL_PREFIX}} {{TRUSTED_NAMESPACE}}", harnessDir: ".renamed", invoke: "bun .renamed/tools/aidlc.ts", invocation: { substitute } })).toBe("delegated");
  expect(substitute.mock.calls).toEqual([[{ source: ".renamed/.renamed {{OPTION_LETTERS}} {{INVOKE}} {{TOOL_PREFIX}} {{TRUSTED_NAMESPACE}}", harnessDir: ".renamed", invoke: "bun .renamed/tools/aidlc.ts" }]]);
});

test.each([
  { letters: "A-D", expected: ".kiro A-D A-D {{INVOKE}}" },
  { letters: "", expected: ".kiro   {{INVOKE}}" },
])("explicit option letters are supplied before Native invocation projection: $letters", ({ letters, expected }) => {
  const substitute = mock<AuthoredInvocationPort["substitute"]>().mockReturnValue("native reply");
  expect(substituteAuthoredTokens({ source: "{{HARNESS_DIR}} {{OPTION_LETTERS}} {{OPTION_LETTERS}} {{INVOKE}}", harnessDir: ".kiro", invoke: "aidlc", letters, invocation: { substitute } })).toBe("native reply");
  expect(substitute.mock.calls).toEqual([[{ source: expected, harnessDir: ".kiro", invoke: "aidlc" }]]);
});

test("unknown authored tokens and shell environment substitutions are untouched before delegation", () => {
  const substitute = mock<AuthoredInvocationPort["substitute"]>().mockReturnValue("native reply");
  expect(substituteAuthoredTokens({ source: "${CONTEXT7_API_KEY} {{UNKNOWN}} {{HARNESS_DIRECTORY}}", harnessDir: ".claude", invoke: "bun .claude/tools/aidlc.ts", invocation: { substitute } })).toBe("native reply");
  expect(substitute.mock.calls).toEqual([[{ source: "${CONTEXT7_API_KEY} {{UNKNOWN}} {{HARNESS_DIRECTORY}}", harnessDir: ".claude", invoke: "bun .claude/tools/aidlc.ts" }]]);
});
