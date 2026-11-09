import { source } from "../../kernel/fixtures/values.fixture.ts";
import type { SourcePath } from "../../kernel/values.ts";
import { accepted } from "../../kernel/result.ts";
import type { CopyChannelAllows, SettingsRenderingInputs } from "../application/ports.ts";
import type { AuthoredHostFile } from "../domain/host-surface.ts";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";
import { text } from "./values.fixture.ts";

export const authoredSettingsFileFixture: AuthoredHostFile = {
  source: source("settings.json"),
  content: text([
    "{",
    '  "permissions": {',
    '    "allow": [',
    '      "Bash(bun {{HARNESS_DIR}}/tools/aidlc.ts engine *)",',
    '      "Bash(bun {{HARNESS_DIR}}/tools/aidlc-*)"',
    "    ]",
    "  },",
    '  "hooks": {',
    '    "SessionStart": [',
    '      { "hooks": [{ "type": "command", "command": "{{INVOKE}} engine hook session-start" }] }',
    "    ]",
    "  }",
    "}",
  ]),
};

export const authoredHookRegistrationFixture: AuthoredHostFile = {
  source: source("hooks.json"),
  content: text([
    "{",
    '  "version": 1,',
    '  "hooks": {',
    '    "sessionStart": [{ "command": "{{INVOKE}} engine adapter host session-start" }]',
    "  }",
    "}",
  ]),
};

export const COPY_CHANNEL_ALLOWS_FIXTURE: CopyChannelAllows = {
  dispatcherCommands: ["doctor", "status", "config --show"],
  toolScripts: ["aidlc-graph.ts", "aidlc-utility.ts"],
};

export const RUNTIME_ENTRYPOINTS_FIXTURE: readonly SourcePath[] = [
  source("hooks/aidlc-session-start.ts"),
  source("tools/aidlc.ts"),
];

export const settingsRenderingInputsFixture = ({ harnessDir, files }: {
  readonly harnessDir: string;
  readonly files: readonly AuthoredHostFile[];
}): SettingsRenderingInputs => ({
  files,
  prepare: (file) => accepted(file),
  tokens: tokenBindingsFixture({ harnessDir }),
  allows: COPY_CHANNEL_ALLOWS_FIXTURE,
  entrypoints: RUNTIME_ENTRYPOINTS_FIXTURE,
  channel: "copy",
});
