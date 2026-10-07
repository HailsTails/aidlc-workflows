import { describe, expect, test } from "bun:test";
import nativeContract from "./aidlc-codex-dispatch-tool.fixture.json";
import {
  CODEX_DISPATCH_MATCHER,
  normalizeCodexDispatchTool,
} from "./aidlc-codex-dispatch-tool.ts";

describe("source-derived native Codex dispatch contract", () => {
  test.each(nativeContract.normalizationCases)(
    "$eventName / $toolName resolves to $expectedName",
    ({ eventName, toolName, expectedName }) => {
      expect(normalizeCodexDispatchTool({ eventName, toolName })).toBe(expectedName);
    },
  );

  test.each(nativeContract.nativeFunctionCases)(
    "$namespace / $name has hook matcher result $expectedMatch",
    ({ hookName, expectedMatch }) => {
      expect(new RegExp(CODEX_DISPATCH_MATCHER).test(hookName)).toBe(expectedMatch);
    },
  );

  test.each(nativeContract.foreignNameCases)(
    "foreign name $toolName has hook matcher result $expectedMatch",
    ({ toolName, expectedMatch }) => {
      expect(new RegExp(CODEX_DISPATCH_MATCHER).test(toolName)).toBe(expectedMatch);
    },
  );

  test("absent event and tool names remain unchanged", () => {
    expect(normalizeCodexDispatchTool({
      eventName: undefined,
      toolName: "collaborationspawn_agent",
    })).toBe("collaborationspawn_agent");
    expect(normalizeCodexDispatchTool({
      eventName: "PreToolUse",
      toolName: undefined,
    })).toBeUndefined();
  });
});
