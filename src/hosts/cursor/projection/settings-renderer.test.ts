import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../kernel/result.ts";
import { path, source } from "../../../kernel/fixtures/values.fixture.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import { createCursorSettingsRenderer } from "./settings-renderer.ts";

const document = `{ "before": 1, "permissions": { "deny": ["Write(secret)"], "allow": [
  "Edit(/**)", "Shell(bun:.renamed/tools/aidlc-*)", { "extension": true }, "Task"
] }, "hooks": { "SessionStart": [{ "command": "literal {{INVOKE}}" }] }, "after": true }`;
const file = { source: source("cli.json"), content: { kind: "text" as const, text: document } };
const inputs = { ...settingsRenderingInputsFixture({ harnessDir: ".renamed", files: [file] }),
  allows: { dispatcherCommands: ["doctor", "config --show"], toolScripts: ["aidlc-graph.ts"] } };
const expected = accepted([{
  path: path(".cursor/cli.json"), mode: "regular" as const,
  origin: { kind: "rendered" as const, concept: "settings" as const, name: "cli.json" },
  content: { kind: "text" as const, text: `{
  "before": 1,
  "permissions": {
    "deny": [
      "Write(secret)"
    ],
    "allow": [
      "Edit(/**)",
      "Shell(bun:.renamed/tools/aidlc.ts doctor)",
      "Shell(bun:.renamed/tools/aidlc.ts config --show)",
      "Shell(bun:.renamed/tools/aidlc-graph.ts)",
      "Shell(bun:.renamed/tools/aidlc-graph.ts *)",
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

test("Cursor expands one captured settings glob in place, preserving every other key and value", () => {
  const prepare = mock(inputs.prepare);
  expect(createCursorSettingsRenderer({ ...inputs, prepare }).renderSettings({ method: methodSliceFixture }))
    .toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith(file);
});

test("only prepared bytes are parsed, with no second token substitution", () => {
  const prepare = mock(() => accepted({ source: source("cli.json"),
    content: { kind: "bytes" as const, bytes: new TextEncoder().encode(document) } }));
  expect(createCursorSettingsRenderer({ ...inputs, files: [{ ...file,
    content: { kind: "text", text: "not JSON before preparation" } }], prepare })
    .renderSettings({ method: methodSliceFixture })).toEqual(expected);
  expect(prepare).toHaveBeenCalledTimes(1);
});

test("a missing captured settings input refuses before preparation", () => {
  const prepare = mock(inputs.prepare);
  expect(createCursorSettingsRenderer({ ...inputs, files: [], prepare })
    .renderSettings({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "settings", name: "cli.json",
      reason: "The authored settings were not captured.",
    }));
  expect(prepare).not.toHaveBeenCalled();
});

test("a settings document with no allow glob retains the legacy refusal", () => {
  expect(createCursorSettingsRenderer({ ...inputs, files: [{ ...file,
    content: { kind: "text", text: '{"permissions":{"allow":["Edit(/**)"]}}' } }] })
    .renderSettings({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "settings", name: "cli.json",
      reason: "cli.json has no Shell(bun:<dir>/tools/aidlc-*) entry to expand",
    }));
});

test("invalid settings JSON is a typed refusal", () => {
  expect(createCursorSettingsRenderer({ ...inputs, files: [{ ...file,
    content: { kind: "text", text: "{" } }] }).renderSettings({ method: methodSliceFixture }))
    .toEqual(refused({ kind: "render-failed", concept: "settings", name: "cli.json",
      reason: "The captured settings are not valid JSON." }));
});

test("preparation refusals keep their actual source and reason", () => {
  expect(createCursorSettingsRenderer({ ...inputs, prepare: () => refused({
    kind: "render-failed", concept: "settings", name: "cli.json", reason: "Preparation failed",
  }) }).renderSettings({ method: methodSliceFixture })).toEqual(refused({
    kind: "render-failed", concept: "settings", name: "cli.json", reason: "Preparation failed",
  }));
});

test("a foreign directory glob is not accepted in place of the host's own glob", () => {
  expect(createCursorSettingsRenderer({ ...inputs, files: [{ ...file,
    content: { kind: "text", text: '{"permissions":{"allow":["Shell(bun:.other/tools/aidlc-*)"]}}' } }] })
    .renderSettings({ method: methodSliceFixture })).toEqual(refused({
      kind: "render-failed", concept: "settings", name: "cli.json",
      reason: "cli.json has no Shell(bun:<dir>/tools/aidlc-*) entry to expand",
    }));
});

const nativeReleaseInputs = { ...inputs, channel: "native" as const,
  tokens: { ...inputs.tokens, ["HARNESS_DIR"]: ".cursor", ["INVOKE"]: "aidlc", ["TRUSTED_NAMESPACE"]: "engine" },
  files: [{ source: source("cli.json"), content: { kind: "text" as const, text: "{\n  \"permissions\": {\n    \"allow\": [\n      \"Shell(bun:.cursor/tools/aidlc.ts engine *)\",\n      \"Shell(bun:.cursor/tools/aidlc-*)\"\n    ],\n    \"deny\": []\n  }\n}\n" } }],
  allows: { toolScripts: [], dispatcherCommands: [
  "doctor",
  "doctor --verbose",
  "version",
  "--doctor",
  "--doctor --verbose",
  "--version",
  "status",
  "--status",
  "config --help",
  "config --show",
  "config --show --json",
  "config models --show",
  "config models --show --json",
  "config models --help",
  "config runtime --show",
  "config runtime --show --json",
  "config runtime --help",
  "config providers --show",
  "config providers --show --json",
  "config providers --help",
  "config trust --show",
  "config trust --show --json",
  "config trust --help",
  "config flags --show",
  "config flags --show --json",
  "config flags --help",
  "config project --show",
  "config project --show --json",
  "config project --help",
  "config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes",
  "config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes",
  "config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes",
  "config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes",
  "config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes",
  "config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes",
  "config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes",
  "config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes",
  "config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes",
  "config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes",
  "config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes",
  "config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes"
] },
};

test("native Cursor settings match the independently generated legacy release bytes", () => {
  expect(createCursorSettingsRenderer(nativeReleaseInputs).renderSettings({ method: methodSliceFixture }))
    .toEqual(accepted([{ path: path(".cursor/cli.json"), mode: "regular",
      origin: { kind: "rendered", concept: "settings", name: "cli.json" },
      content: { kind: "text", text: "{\n  \"permissions\": {\n    \"allow\": [\n      \"Shell(aidlc:engine *)\",\n      \"Shell(aidlc:doctor)\",\n      \"Shell(aidlc:doctor --verbose)\",\n      \"Shell(aidlc:version)\",\n      \"Shell(aidlc:--doctor)\",\n      \"Shell(aidlc:--doctor --verbose)\",\n      \"Shell(aidlc:--version)\",\n      \"Shell(aidlc:status)\",\n      \"Shell(aidlc:--status)\",\n      \"Shell(aidlc:config --help)\",\n      \"Shell(aidlc:config --show)\",\n      \"Shell(aidlc:config --show --json)\",\n      \"Shell(aidlc:config models --show)\",\n      \"Shell(aidlc:config models --show --json)\",\n      \"Shell(aidlc:config models --help)\",\n      \"Shell(aidlc:config runtime --show)\",\n      \"Shell(aidlc:config runtime --show --json)\",\n      \"Shell(aidlc:config runtime --help)\",\n      \"Shell(aidlc:config providers --show)\",\n      \"Shell(aidlc:config providers --show --json)\",\n      \"Shell(aidlc:config providers --help)\",\n      \"Shell(aidlc:config trust --show)\",\n      \"Shell(aidlc:config trust --show --json)\",\n      \"Shell(aidlc:config trust --help)\",\n      \"Shell(aidlc:config flags --show)\",\n      \"Shell(aidlc:config flags --show --json)\",\n      \"Shell(aidlc:config flags --help)\",\n      \"Shell(aidlc:config project --show)\",\n      \"Shell(aidlc:config project --show --json)\",\n      \"Shell(aidlc:config project --help)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes)\",\n      \"Shell(aidlc:config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes)\"\n    ],\n    \"deny\": []\n  }\n}\n" } }]));
});

test("native Cursor permissions preserve unrelated values and the exact legacy prefix rule", () => {
  expect(createCursorSettingsRenderer({ ...inputs, channel: "native",
    tokens: { ...inputs.tokens, ["TRUSTED_NAMESPACE"]: "renamed" }, files: [{ ...file,
      content: { kind: "text", text: '{"before":1,"permissions":{"deny":["Write(secret)"],"allow":[' +
        '"Shell(bun:.renamed/tools/aidlc-*)","Shell(bun:other)","Shell(bunx safe)",' +
        '"Shell(git status)","Shell(aidlc:custom)",{"extension":true},"Task"]},"after":true}' } }] })
    .renderSettings({ method: methodSliceFixture })).toEqual(accepted([{
      path: path(".cursor/cli.json"), mode: "regular",
      origin: { kind: "rendered", concept: "settings", name: "cli.json" },
      content: { kind: "text", text: `{
  "before": 1,
  "permissions": {
    "deny": [
      "Write(secret)"
    ],
    "allow": [
      "Shell(git status)",
      "Shell(aidlc:custom)",
      {
        "extension": true
      },
      "Task",
      "Shell(aidlc:renamed *)",
      "Shell(aidlc:doctor)",
      "Shell(aidlc:config --show)"
    ]
  },
  "after": true
}
` },
    }]));
});

test("native Cursor settings refuse a missing trusted namespace", () => {
  expect(createCursorSettingsRenderer({ ...inputs, channel: "native",
    tokens: { ...inputs.tokens, ["TRUSTED_NAMESPACE"]: null } }).renderSettings({ method: methodSliceFixture }))
    .toEqual(refused({ kind: "render-failed", concept: "settings", name: "cli.json",
      reason: "The native settings require a trusted route namespace." }));
});
