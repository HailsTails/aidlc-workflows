import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { createClaudeSettingsRenderer } from "./settings-renderer.ts";

const document = `{ "before": 1, "permissions": { "deny": ["Write(secret)"], "allow": [
  "Edit(/**)", "Bash(bun .renamed/tools/aidlc-*)", { "extension": true }, "Task"
] }, "hooks": { "SessionStart": [{ "command": "literal {{INVOKE}}" }] }, "after": true }`;
const file = { source: source("settings.json"), content: { kind: "text" as const, text: document } };
const inputs = { ...settingsRenderingInputsFixture({ harnessDir: ".renamed", files: [file] }),
  allows: { dispatcherCommands: ["doctor", "config --show"], toolScripts: ["aidlc-graph.ts"] } };
const expected = accepted([{
  path: path(".claude/settings.json"), mode: "regular" as const,
  origin: { kind: "rendered" as const, concept: "settings" as const, name: "settings.json" },
  content: { kind: "text" as const, text: `{
  "before": 1,
  "permissions": {
    "deny": [
      "Write(secret)"
    ],
    "allow": [
      "Edit(/**)",
      "Bash(bun .renamed/tools/aidlc.ts doctor)",
      "Bash(bun .renamed/tools/aidlc.ts config --show)",
      "Bash(bun .renamed/tools/aidlc-graph.ts)",
      "Bash(bun .renamed/tools/aidlc-graph.ts *)",
      {
        "extension": true
      },
      "Task"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "command": "literal {{INVOKE}}"
      }
    ]
  },
  "after": true
}
` },
}]);

test("Claude expands one captured settings glob in place, preserving every other key and value", () => {
  const prepare = mock(inputs.prepare);
  expect(createClaudeSettingsRenderer({ ...inputs, prepare }).renderSettings({ method: methodSliceFixture }))
    .toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith(file);
});

test("only prepared bytes are parsed, with no second token substitution", () => {
  const prepare = mock(() => accepted({ source: source("settings.json"),
    content: { kind: "bytes" as const, bytes: new TextEncoder().encode(document) } }));
  expect(createClaudeSettingsRenderer({ ...inputs, files: [{ ...file,
    content: { kind: "text", text: "not JSON before preparation" } }], prepare })
    .renderSettings({ method: methodSliceFixture })).toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(1);
});

test("a missing captured settings input refuses before preparation", () => {
  const prepare = mock(inputs.prepare);
  expect(createClaudeSettingsRenderer({ ...inputs, files: [], prepare })
    .renderSettings({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "settings", name: "settings.json",
      reason: "The authored settings were not captured.",
    }));
  expect(prepare).not.toHaveBeenCalled();
});

test("a settings document with no allow glob retains the legacy refusal", () => {
  expect(createClaudeSettingsRenderer({ ...inputs, files: [{ ...file,
    content: { kind: "text", text: '{"permissions":{"allow":["Edit(/**)"]}}' } }] })
    .renderSettings({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "settings", name: "settings.json",
      reason: "settings.json has no Bash(bun <dir>/tools/aidlc-*) entry to expand",
    }));
});

test("invalid settings JSON is a typed refusal", () => {
  expect(createClaudeSettingsRenderer({ ...inputs, files: [{ ...file,
    content: { kind: "text", text: "{" } }] }).renderSettings({ method: methodSliceFixture }))
    .toEqual(refused({ kind: "render-failed", concept: "settings", name: "settings.json",
      reason: "The captured settings are not valid JSON." }));
});

test("preparation refusals keep their actual source and reason", () => {
  expect(createClaudeSettingsRenderer({ ...inputs, prepare: () => refused({
    kind: "render-failed", concept: "settings", name: "settings.json", reason: "Preparation failed",
  }) }).renderSettings({ method: methodSliceFixture })).toEqual(refused({
    kind: "render-failed", concept: "settings", name: "settings.json", reason: "Preparation failed",
  }));
});

test("hooks already in Claude settings are not emitted a second time", () => {
  expect(createClaudeSettingsRenderer(inputs).renderHookRegistrations({ hooks: [] })).toEqual(accepted([]));
});
