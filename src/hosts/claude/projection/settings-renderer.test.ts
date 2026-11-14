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

const nativeReleaseInputs = () => ({ ...inputs, channel: "native" as const,
    tokens: { ...inputs.tokens, ["INVOKE"]: "aidlc", ["TOOL_PREFIX"]: "aidlc ", ["TRUSTED_NAMESPACE"]: "engine" },
    files: [{ ...file, content: { kind: "text" as const, text:
      '{"permissions":{"allow":["Edit(/**)","Bash(bun .claude/tools/aidlc-*)","Task","WebSearch"]}}' } }],
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
      "config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes",
    ] } });

test("native permission bytes match the independently generated legacy release", () => {
  expect(createClaudeSettingsRenderer(nativeReleaseInputs()).renderSettings({ method: methodSliceFixture }))
    .toEqual(accepted([{
    path: path(".claude/settings.json"), mode: "regular",
    origin: { kind: "rendered", concept: "settings", name: "settings.json" },
    content: { kind: "text", text: `{
  "permissions": {
    "allow": [
      "Edit(/**)",
      "Task",
      "WebSearch",
      "Bash(aidlc engine *)",
      "Bash(aidlc doctor)",
      "Bash(aidlc doctor --verbose)",
      "Bash(aidlc version)",
      "Bash(aidlc --doctor)",
      "Bash(aidlc --doctor --verbose)",
      "Bash(aidlc --version)",
      "Bash(aidlc status)",
      "Bash(aidlc --status)",
      "Bash(aidlc config --help)",
      "Bash(aidlc config --show)",
      "Bash(aidlc config --show --json)",
      "Bash(aidlc config models --show)",
      "Bash(aidlc config models --show --json)",
      "Bash(aidlc config models --help)",
      "Bash(aidlc config runtime --show)",
      "Bash(aidlc config runtime --show --json)",
      "Bash(aidlc config runtime --help)",
      "Bash(aidlc config providers --show)",
      "Bash(aidlc config providers --show --json)",
      "Bash(aidlc config providers --help)",
      "Bash(aidlc config trust --show)",
      "Bash(aidlc config trust --show --json)",
      "Bash(aidlc config trust --help)",
      "Bash(aidlc config flags --show)",
      "Bash(aidlc config flags --show --json)",
      "Bash(aidlc config flags --help)",
      "Bash(aidlc config project --show)",
      "Bash(aidlc config project --show --json)",
      "Bash(aidlc config project --help)",
      "Bash(aidlc config flags --clear-bypass AIDLC_SKIP_ARTIFACT_GUARD --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_SKIP_REVISION_BACKSTOP --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_SKIP_HUMAN_PRESENCE_GUARD --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_ENSEMBLE_EVIDENCE --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_REVIEWER_SCOPE_HOOK --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_REVIEW_FREEZE_HOOK --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_USAGE_TRACKING --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_SENSORS --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_LEARNINGS --yes)",
      "Bash(aidlc config flags --clear-bypass AIDLC_DISABLE_SUMMARY_CONFIRMATION --yes)"
    ]
  }
}
` },
  }]));
});

test("native permissions remove only legacy Bash grants and preserve unrelated values", () => {
  expect(createClaudeSettingsRenderer({ ...inputs, channel: "native",
    tokens: { ...inputs.tokens, ["INVOKE"]: "aidlc", ["TRUSTED_NAMESPACE"]: "renamed" },
    files: [{ ...file, content: { kind: "text", text: '{"before":1,"permissions":{"deny":["Write(secret)"],'
      + '"allow":["Bash","Bash(bun .renamed/tools/aidlc-*)","Bash(bun other)","Bash(aidlc stale)",'
      + '"Bash(git status)","Bash(bunx safe)",{"extension":true},"Task"]},"after":true}' } }] })
    .renderSettings({ method: methodSliceFixture })).toEqual(accepted([{
      path: path(".claude/settings.json"), mode: "regular",
      origin: { kind: "rendered", concept: "settings", name: "settings.json" },
      content: { kind: "text", text: `{
  "before": 1,
  "permissions": {
    "deny": [
      "Write(secret)"
    ],
    "allow": [
      "Bash(git status)",
      "Bash(bunx safe)",
      {
        "extension": true
      },
      "Task",
      "Bash(aidlc renamed *)",
      "Bash(aidlc doctor)",
      "Bash(aidlc config --show)"
    ]
  },
  "after": true
}
` },
    }]));
});

test("native settings refuse a missing namespace rather than emitting a null grant", () => {
  expect(createClaudeSettingsRenderer({ ...inputs, channel: "native",
    tokens: { ...inputs.tokens, ["TRUSTED_NAMESPACE"]: null } }).renderSettings({ method: methodSliceFixture }))
    .toEqual(refused({ kind: "render-failed", concept: "settings", name: "settings.json",
      reason: "The native settings require a trusted route namespace." }));
});
