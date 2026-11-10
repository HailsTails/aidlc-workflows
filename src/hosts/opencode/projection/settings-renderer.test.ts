import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { createOpenCodeSettingsRenderer, OPENCODE_SETTINGS_INPUTS } from "./settings-renderer.ts";

const settings = { source: source("opencode.json"), content: { kind: "text" as const,
  text: '{"permission":{"bash":{"{{TOOL_PREFIX}}*":"allow"}}}\r\n' } };
const adapter = { source: source("plugin/aidlc-opencode-adapter.ts"), content: { kind: "text" as const,
  text: 'import { launch } from "../../../core/tools/aidlc-executable-path.ts";\n'
    + 'const entries = /* @aidlc-shipped-entrypoints@ */ [];\n'
    + 'const tokens = "{{HARNESS_DIR}}|{{INVOKE}}|{{TOOL_PREFIX}}|{{TRUSTED_NAMESPACE}}|{{OPTION_LETTERS}}|{{SKILL_INVOKE}}";\n' } };
const inputs = settingsRenderingInputsFixture({ harnessDir: ".aidlc", files: [settings, adapter] });

const copyAdapter = 'import { launch } from "../../.aidlc/tools/aidlc-executable-path.ts";\n'
  + 'const entries = /* @aidlc-shipped-entrypoints@ */ [\n'
  + '    "hooks/aidlc-session-start.ts",\n'
  + '    "tools/aidlc.ts"\n'
  + '  ];\n'
  + 'const tokens = ".aidlc|bun .aidlc/tools/aidlc.ts|bun .aidlc/tools/|aidlc|A-E|{{SKILL_INVOKE}}";\n';

const nativeAdapter = 'import { launch } from "../../.aidlc/tools/aidlc-executable-path.ts";\n'
  + 'const entries = /* @aidlc-shipped-entrypoints@ */ [\n'
  + '    "hooks/aidlc-session-start.ts",\n'
  + '    "tools/aidlc.ts"\n'
  + '  ];\n'
  + 'const tokens = ".aidlc|aidlc|aidlc |trusted|A-D|/aidlc";\n';

test("OpenCode captures only its project settings and native hook adapter", () => {
  expect(OPENCODE_SETTINGS_INPUTS).toEqual(["opencode.json", "plugin/aidlc-opencode-adapter.ts"]);
});

test("settings preserve prepared JSON bytes at the project root with authored origin", () => {
  const prepared = { ...settings, content: { kind: "bytes" as const,
    bytes: new TextEncoder().encode('{"permission":{"bash":{"bun .aidlc/tools/*":"allow"}}}\r\n') } };
  const prepare = mock(() => accepted(prepared));
  expect(createOpenCodeSettingsRenderer({ ...inputs, prepare }).renderSettings({ method: methodSliceFixture }))
    .toEqual(accepted([{ path: path("opencode.json"), content: prepared.content,
      mode: "regular", availability: "always", origin: { kind: "harness-authored", source: settings.source } }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith(settings);
});

test("copy plugin embeds captured entrypoints before imports and the complete token pass", () => {
  const prepare = mock(inputs.prepare);
  expect(createOpenCodeSettingsRenderer({ ...inputs, prepare }).renderHookRegistrations({ hooks: [] }))
    .toEqual(accepted([{ path: path(".opencode/plugin/aidlc-opencode-adapter.ts"),
      content: { kind: "text", text: copyAdapter }, mode: "regular", availability: "always",
      origin: { kind: "harness-authored", source: adapter.source } }]));
  expect(prepare).not.toHaveBeenCalled();
});

test("native plugin uses captured tokens for every token, including non-invocation tokens", () => {
  expect(createOpenCodeSettingsRenderer({ ...inputs, channel: "native", tokens: {
    ["HARNESS_DIR"]: ".aidlc", ["INVOKE"]: "aidlc", ["TOOL_PREFIX"]: "aidlc ",
    ["TRUSTED_NAMESPACE"]: "trusted", ["OPTION_LETTERS"]: "A-D", ["SKILL_INVOKE"]: "/aidlc",
  } }).renderHookRegistrations({ hooks: [] })).toEqual(accepted([{
    path: path(".opencode/plugin/aidlc-opencode-adapter.ts"), content: { kind: "text", text: nativeAdapter },
    mode: "regular", availability: "always", origin: { kind: "harness-authored", source: adapter.source },
  }]));
});

test("captured byte content follows the same plugin path", () => {
  expect(createOpenCodeSettingsRenderer({ ...inputs, files: [{ ...adapter,
    content: { kind: "bytes", bytes: new TextEncoder().encode(adapter.content.text) },
  }] }).renderHookRegistrations({ hooks: [] })).toEqual(accepted([{
    path: path(".opencode/plugin/aidlc-opencode-adapter.ts"), content: { kind: "text", text: copyAdapter },
    mode: "regular", availability: "always", origin: { kind: "harness-authored", source: adapter.source },
  }]));
});

test("missing settings names the missing authored input", () => {
  expect(createOpenCodeSettingsRenderer({ ...inputs, files: [] }).renderSettings({ method: methodSliceFixture }))
    .toEqual(refused({ kind: "render-failed", concept: "settings", name: "opencode.json",
      reason: "The authored OpenCode settings were not captured." }));
});

test("settings preparation failure is preserved", () => {
  const failure = refused({ kind: "render-failed" as const, concept: "settings" as const,
    name: "opencode.json", reason: "Token preparation refused." });
  expect(createOpenCodeSettingsRenderer({ ...inputs, prepare: () => failure })
    .renderSettings({ method: methodSliceFixture })).toEqual(failure);
});

test("missing plugin names its captured input", () => {
  expect(createOpenCodeSettingsRenderer({ ...inputs, files: [] }).renderHookRegistrations({ hooks: [] }))
    .toEqual(refused({ kind: "render-failed", concept: "hook-registration", name: adapter.source,
      reason: "The authored OpenCode hook adapter was not captured." }));
});

test("the plugin refuses a missing entrypoint marker", () => {
  expect(createOpenCodeSettingsRenderer({ ...inputs, files: [{ ...adapter,
    content: { kind: "text", text: 'import { launch } from "../../../core/tools/aidlc-executable-path.ts";\n' },
  }] }).renderHookRegistrations({ hooks: [] })).toEqual(refused({
    kind: "render-failed", concept: "hook-registration", name: adapter.source,
    reason: "opencode adapter is missing its shipped-entrypoint emission marker.",
  }));
});

test("the plugin refuses an absent engine-directory token", () => {
  expect(createOpenCodeSettingsRenderer({ ...inputs,
    tokens: { ...inputs.tokens, ["HARNESS_DIR"]: null },
  }).renderHookRegistrations({ hooks: [] })).toEqual(refused({
    kind: "render-failed", concept: "hook-registration", name: adapter.source,
    reason: "The OpenCode engine directory token is required.",
  }));
});

test("the plugin refuses a missing authored tool import", () => {
  expect(createOpenCodeSettingsRenderer({ ...inputs, files: [{ ...adapter,
    content: { kind: "text", text: 'const entries = /* @aidlc-shipped-entrypoints@ */ [];\n' },
  }] }).renderHookRegistrations({ hooks: [] })).toEqual(refused({
    kind: "render-failed", concept: "hook-registration", name: adapter.source,
    reason: "opencode adapter no longer imports aidlc-executable-path.ts from core/tools.",
  }));
});
