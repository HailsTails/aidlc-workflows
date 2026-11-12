import { expect, mock, test } from "bun:test";
import { accepted } from "../../../kernel/result.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { COPILOT_SETTINGS_INPUTS, createCopilotSettingsRenderer } from "./settings-renderer.ts";

const inputs = settingsRenderingInputsFixture({ harnessDir: ".renamed", files: [] });
const expectedText = `{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts session-start",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts session-start",
        "timeoutSec": 12
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts record-human-turn",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts record-human-turn",
        "timeoutSec": 12
      }
    ],
    "PreToolUse": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts guard-tool-call",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts guard-tool-call",
        "timeoutSec": 12
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts post-tool",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts post-tool",
        "timeoutSec": 24
      }
    ],
    "PreCompact": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts validate-state",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts validate-state",
        "timeoutSec": 12
      }
    ],
    "SubagentStart": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts subagent-start",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts subagent-start",
        "timeoutSec": 12
      }
    ],
    "SubagentStop": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts log-subagent",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts log-subagent",
        "timeoutSec": 12
      }
    ],
    "Stop": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts continue-workflow",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts continue-workflow",
        "timeoutSec": 24
      }
    ]
  }
}
`;
const expectedFractionalText = `{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts session-start",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts session-start",
        "timeoutSec": 7.5
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts record-human-turn",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts record-human-turn",
        "timeoutSec": 7.5
      }
    ],
    "PreToolUse": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts guard-tool-call",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts guard-tool-call",
        "timeoutSec": 7.5
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts post-tool",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts post-tool",
        "timeoutSec": 15
      }
    ],
    "PreCompact": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts validate-state",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts validate-state",
        "timeoutSec": 7.5
      }
    ],
    "SubagentStart": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts subagent-start",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts subagent-start",
        "timeoutSec": 7.5
      }
    ],
    "SubagentStop": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts log-subagent",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts log-subagent",
        "timeoutSec": 7.5
      }
    ],
    "Stop": [
      {
        "type": "command",
        "bash": "bun .renamed/hooks/aidlc-copilot-adapter.ts continue-workflow",
        "powershell": "bun .renamed/hooks/aidlc-copilot-adapter.ts continue-workflow",
        "timeoutSec": 15
      }
    ]
  }
}
`;
const launcherFile = (text: string) => ({
  path: path(".fixture/bin/engine"), mode: "executable" as const,
  origin: { kind: "rendered" as const, concept: "hook-registration" as const, name: "aidlc-engine" },
  content: { kind: "text" as const, text },
});
const expectedLauncher = launcherFile("run bun .renamed/tools/aidlc.ts engine\n");
const expectedFile = {
  path: path(".github/hooks/aidlc.json"), mode: "regular" as const,
  origin: { kind: "rendered" as const, concept: "hook-registration" as const, name: "aidlc.json" },
  content: { kind: "text" as const, text: expectedText },
};

test("Copilot captures no settings and leaves root integration settings to their owner", () => {
  const prepare = mock(inputs.prepare);
  expect(COPILOT_SETTINGS_INPUTS).toEqual([]);
  expect(createCopilotSettingsRenderer({ ...inputs, prepare }).renderSettings({ method: methodSliceFixture }))
    .toEqual(accepted([]));
  expect(prepare).not.toHaveBeenCalled();
});

test("Copilot emits every literal event in order with matching shell commands and no matchers", () => {
  const prepare = mock(inputs.prepare);
  expect(createCopilotSettingsRenderer({ ...inputs, prepare }).renderHookRegistrations({ hooks: [] }))
    .toEqual(accepted([expectedFile, expectedLauncher]));
  expect(prepare).not.toHaveBeenCalled();
});

test("both channels retain the adapter command rather than substituting the native invoke", () => {
  expect(createCopilotSettingsRenderer({ ...inputs, channel: "native",
    tokens: { ...inputs.tokens, ["INVOKE"]: "aidlc" } }).renderHookRegistrations({ hooks: [] }))
    .toEqual(accepted([expectedFile, launcherFile("run aidlc engine\n")]));
});

test("the supplied millisecond budget becomes seconds and doubles only compound events", () => {
  expect(createCopilotSettingsRenderer({ ...inputs, extendedSubprocessTimeoutMs: 7_500 })
    .renderHookRegistrations({ hooks: [] })).toEqual(accepted([{ ...expectedFile, content: {
      kind: "text", text: expectedFractionalText,
    } }, expectedLauncher]));
});
