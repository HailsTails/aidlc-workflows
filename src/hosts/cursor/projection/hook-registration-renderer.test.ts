import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { createCursorSettingsRenderer, CURSOR_SETTINGS_INPUTS } from "./settings-renderer.ts";

const file = { source: source("hooks.json"), content: { kind: "text" as const,
  text: '{"version":1,"hooks":{"sessionStart":[{"command":"{{INVOKE}} session-start"}]}}\n' } };
const prepared = { ...file, content: { kind: "text" as const,
  text: '{"version":1,"hooks":{"sessionStart":[{"command":"bun .cursor/tools/aidlc.ts session-start"}]}}\n' } };
const inputs = settingsRenderingInputsFixture({ harnessDir: ".cursor", files: [file] });

test("Cursor captures only its settings and hook registration inputs", () => {
  expect(CURSOR_SETTINGS_INPUTS).toEqual(["cli.json", "hooks.json"]);
});

test("Cursor hook registration places exact prepared JSON bytes once without reserialization", () => {
  const prepare = mock(inputs.prepare).mockReturnValue(accepted(prepared));
  expect(createCursorSettingsRenderer({ ...inputs, prepare }).renderHookRegistrations({ hooks: [] }))
    .toEqual(accepted([{
      path: path(".cursor/hooks.json"), content: {
        kind: "text",
        text: '{"version":1,"hooks":{"sessionStart":[{"command":"bun .cursor/tools/aidlc.ts session-start"}]}}\n',
      },
      mode: "regular", availability: "always",
      origin: { kind: "harness-authored", source: source("hooks.json") },
    }]));
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith(file);
});

test("a missing Cursor hook capture refuses before preparation", () => {
  const prepare = mock(inputs.prepare);
  expect(createCursorSettingsRenderer({ ...inputs, prepare, files: [] }).renderHookRegistrations({ hooks: [] }))
    .toEqual(refused({ kind: "render-failed", concept: "hook-registration", name: "hooks.json",
      reason: "The authored Cursor hook registration was not captured." }));
  expect(prepare).not.toHaveBeenCalled();
});

test("Cursor hook preparation refusal retains the actual source and reason", () => {
  const failure = refused({ kind: "render-failed" as const, concept: "hook-registration" as const,
    name: "hooks.json", reason: "Token preparation refused." });
  expect(createCursorSettingsRenderer({ ...inputs, prepare: () => failure }).renderHookRegistrations({ hooks: [] }))
    .toEqual(failure);
});
