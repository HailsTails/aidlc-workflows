import { expect, mock, test } from "bun:test";
import { admitClaudeHookCommand, renderClaudeHookCommand } from "./hook-command.ts";

const authored = 'bun "$CLAUDE_PROJECT_DIR/.renamed/tools/aidlc.ts" engine hook session-start';

test("a captured framework hook becomes a purpose value before a serializer sees it", () => {
  expect(admitClaudeHookCommand({ command: authored, directory: ".renamed" }))
    .toEqual({ kind: "engine-hook", hook: "session-start", authored });
});

test.each([
  "echo user-hook",
  'bun "$CLAUDE_PROJECT_DIR/.other/tools/aidlc.ts" engine hook session-start',
  'bun "$CLAUDE_PROJECT_DIR/.renamed/tools/aidlc.ts" engine hook session-start --extra',
  `bun "\${CLAUDE_PROJECT_DIR}/.renamed/tools/aidlc.ts" engine hook session-start`,
  'bun "$CLAUDE_PROJECT_DIR/.renamed/tools/aidlc.ts" engine hook ../outside',
])("an unadmitted command remains explicitly opaque: %s", (command) => {
  expect(admitClaudeHookCommand({ command, directory: ".renamed" })).toEqual({ kind: "opaque", authored: command });
});

test("copy retains the exact admitted source and does not request a native command", () => {
  const trusted = mock(() => "unused");
  expect(renderClaudeHookCommand({ command: { kind: "engine-hook", hook: "session-start", authored },
    channel: "copy", trusted })).toBe(authored);
  expect(trusted).not.toHaveBeenCalled();
});

test("native rendering delegates the modeled hook purpose to the one trusted owner", () => {
  const trusted = mock(() => "bound runtime hook session-start");
  expect(renderClaudeHookCommand({ command: { kind: "engine-hook", hook: "session-start", authored },
    channel: "native", trusted })).toBe("bound runtime hook session-start");
  expect(trusted).toHaveBeenCalledTimes(1);
  expect(trusted).toHaveBeenCalledWith("hook session-start");
});

test("opaque native commands retain their bytes without a route request", () => {
  const trusted = mock(() => "unused");
  expect(renderClaudeHookCommand({ command: { kind: "opaque", authored: "echo custom" },
    channel: "native", trusted })).toBe("echo custom");
  expect(trusted).not.toHaveBeenCalled();
});

test("a missing captured directory leaves the command opaque", () => {
  expect(admitClaudeHookCommand({ command: authored, directory: null }))
    .toEqual({ kind: "opaque", authored });
});
