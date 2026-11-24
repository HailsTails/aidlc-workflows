import { expect, mock, test } from "bun:test";
import { projectCapturedClaudeHooks } from "./captured-hooks.ts";

const captured = { ["SessionStart"]: [{ matcher: "", hooks: [{ before: 1, type: "command",
  command: 'bun "$CLAUDE_PROJECT_DIR/.renamed/tools/aidlc.ts" engine hook session-start', timeout: 1800 },
{ type: "command", command: "echo custom" }, { type: "prompt", prompt: "keep" }], after: true }] };

test("the copy channel preserves every captured JSON field and command", () => {
  const trusted = mock(() => "unused");
  expect(projectCapturedClaudeHooks({ captured, directory: ".renamed", channel: "copy", trusted }))
    .toEqual(captured);
  expect(trusted).not.toHaveBeenCalled();
});

test("native changes only an admitted command value, retaining matcher and extension fields", () => {
  const trusted = mock(() => "bound hook session-start");
  expect(projectCapturedClaudeHooks({ captured, directory: ".renamed", channel: "native", trusted }))
    .toEqual({ ["SessionStart"]: [{ matcher: "", hooks: [{ before: 1, type: "command",
      command: "bound hook session-start", timeout: 1800 }, { type: "command", command: "echo custom" },
    { type: "prompt", prompt: "keep" }], after: true }] });
  expect(trusted).toHaveBeenCalledTimes(1);
  expect(trusted).toHaveBeenCalledWith("hook session-start");
});

test.each([{ captured: undefined }, { captured: null }, { captured: [] }, { captured: "literal" },
  { captured: { ["Extension"]: false } },
  { captured: { ["SessionStart"]: [{ command: "not a matcher collection" }] } },
  { captured: { ["SessionStart"]: [{ hooks: [{ type: "command", command: 42 }] }] } },
])("unknown or malformed hook shapes stay opaque without new refusals: %p", ({ captured }) => {
  const trusted = mock(() => "unused");
  expect(projectCapturedClaudeHooks({ captured, directory: ".renamed", channel: "native", trusted }))
    .toEqual(captured);
  expect(trusted).not.toHaveBeenCalled();
});

const extensionFields = { ["__proto__"]: "event-extension", ["SessionStart"]: [{
  ["__proto__"]: "matcher-extension", hooks: [{ ["__proto__"]: "command-extension",
    type: "command", command: 'bun "$CLAUDE_PROJECT_DIR/.renamed/tools/aidlc.ts" engine hook session-start' }],
}] };

test("copy preserves opaque extension keys at every captured hook boundary", () => {
  const trusted = mock(() => "unused");
  expect(projectCapturedClaudeHooks({ captured: extensionFields, directory: ".renamed", channel: "copy", trusted }))
    .toEqual(extensionFields);
  expect(trusted).not.toHaveBeenCalled();
});
