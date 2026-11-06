import { expect, test } from "bun:test";
import { copyHarnessBinding } from "./harness-binding.ts";
test.each([
  [{ harness: "claude", directory: ".claude" }, { harness: "claude", directory: ".claude" }],
  [{ harness: "cursor", directory: ".cursor" }, { harness: "cursor", directory: ".cursor" }],
  [{ harness: "codex", directory: ".codex" }, { harness: "codex", directory: ".codex" }],
  [{ harness: "copilot", directory: ".aidlc" }, { harness: "copilot", directory: ".aidlc" }],
  [{ harness: "opencode", directory: ".aidlc" }, { harness: "opencode", directory: ".aidlc" }],
  [{ harness: "kiro", directory: ".kiro" }, { harness: "kiro", directory: ".kiro" }],
  [{ harness: "kiro-ide", directory: ".kiro" }, { harness: "kiro-ide", directory: ".kiro" }],
] as const)("copies the engine binding without changing its correlated directory: %s", (binding, expected) => {
  expect(copyHarnessBinding({ binding })).toEqual(expected);
});
test("delivery context and policy fields cannot leak into a binding record", () => {
  const context = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", modelInvocation: "native-default" } as const;
  expect(copyHarnessBinding({ binding: context })).toEqual({ harness: "claude", directory: ".claude" });
});
