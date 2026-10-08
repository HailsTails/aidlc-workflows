import { describe, expect, mock, test } from "bun:test";
import {
  type HookRegistrationPlanResult,
  type PlanPluginHookRegistrationsInput,
  type PluginHookContribution,
  planPluginHookRegistrations,
  type CodexHookTrustIdentityInput,
  planCodexHookTrustSeed,
} from "./aidlc-plugin-hook-registrations.ts";

const claudeContribution: PluginHookContribution = {
  kind: "group",
  path: ".claude/settings.json",
  event: "PreToolUse",
  group: { matcher: "Bash", hooks: [{ type: "command", command: "bun .claude/hooks/guard.ts" }] },
};

const codexContribution: PluginHookContribution = {
  kind: "group",
  path: ".codex/hooks.json",
  event: "PreToolUse",
  group: { matcher: "Bash", hooks: [{ type: "command", command: "bun .codex/tools/aidlc.ts engine adapter codex example-guard" }] },
};

const copilotContribution: PluginHookContribution = {
  kind: "group",
  path: ".github/hooks/aidlc.json",
  event: "PreToolUse",
  group: {
    type: "command",
    bash: "bun .aidlc/hooks/aidlc-copilot-adapter.ts example-guard",
    powershell: "bun .aidlc/hooks/aidlc-copilot-adapter.ts example-guard",
    timeoutSec: 30,
  },
};

function plannedDocument(input: {
  readonly result: HookRegistrationPlanResult;
  readonly path: string;
}): unknown {
  if (input.result.kind !== "planned") return null;
  return JSON.parse(input.result.documents.find((document) => document.path === input.path)?.text ?? "null");
}

function selectedPlan(input: {
  readonly harness: PlanPluginHookRegistrationsInput["harness"];
  readonly current: readonly PluginHookContribution[];
  readonly documents: PlanPluginHookRegistrationsInput["documents"];
}): HookRegistrationPlanResult {
  return planPluginHookRegistrations({
    pluginName: "example",
    harness: input.harness,
    selection: { kind: "selected" },
    previous: [],
    current: input.current,
    documents: input.documents,
  });
}

describe("selected native plugin hook registration planning", () => {
  test("Claude appends its native group after user groups and preserves other settings", () => {
    const result = selectedPlan({
      harness: "claude",
      current: [claudeContribution],
      documents: [{ path: ".claude/settings.json", text: '{"model":"consumer-model","permissions":{"allow":["Bash(date)"]},"hooks":{"PreToolUse":[{"matcher":"Read","hooks":[{"type":"command","command":"user-read"}]}]}}' }],
    });
    expect(result.kind).toBe("planned");
    expect(plannedDocument({ result, path: ".claude/settings.json" })).toEqual({
      model: "consumer-model",
      permissions: { allow: ["Bash(date)"] },
      hooks: { PreToolUse: [
        { matcher: "Read", hooks: [{ type: "command", command: "user-read" }] },
        { matcher: "Bash", hooks: [{ type: "command", command: "bun .claude/hooks/guard.ts" }] },
      ] },
    });
    expect(result).toMatchObject({ ownedRegistrations: [claudeContribution] });
  });

  test("Codex appends its native group and target while preserving user registrations", () => {
    const result = selectedPlan({
      harness: "codex",
      current: [codexContribution, { kind: "target", path: ".codex/hooks/plugin-hook-targets.json", target: "example-guard", hookFile: "guard.ts" }],
      documents: [
        { path: ".codex/hooks.json", text: '{"consumer":"preserved","hooks":{"PreToolUse":[{"hooks":[{"type":"command","command":"user-check"}]}]}}' },
        { path: ".codex/hooks/plugin-hook-targets.json", text: '{"user-guard":"user-guard.ts"}' },
      ],
    });
    expect(result.kind).toBe("planned");
    expect(plannedDocument({ result, path: ".codex/hooks.json" })).toEqual({
      consumer: "preserved",
      hooks: { PreToolUse: [
        { hooks: [{ type: "command", command: "user-check" }] },
        { matcher: "Bash", hooks: [{ type: "command", command: "bun .codex/tools/aidlc.ts engine adapter codex example-guard" }] },
      ] },
    });
    expect(plannedDocument({ result, path: ".codex/hooks/plugin-hook-targets.json" })).toEqual({ "user-guard": "user-guard.ts", "example-guard": "guard.ts" });
  });

  test("Copilot preserves its flat host entry and user target without adding matchers", () => {
    const result = selectedPlan({
      harness: "copilot",
      current: [copilotContribution, { kind: "target", path: ".aidlc/hooks/plugin-hook-targets.json", target: "example-guard", hookFile: "guard.ts" }],
      documents: [
        { path: ".github/hooks/aidlc.json", text: '{"version":1,"hooks":{"PreToolUse":[{"type":"command","bash":"user-check","powershell":"user-check","timeoutSec":10}]}}' },
        { path: ".aidlc/hooks/plugin-hook-targets.json", text: '{"user-guard":"user-guard.ts"}' },
      ],
    });
    expect(result.kind).toBe("planned");
    expect(plannedDocument({ result, path: ".github/hooks/aidlc.json" })).toEqual({
      version: 1,
      hooks: { PreToolUse: [
        { type: "command", bash: "user-check", powershell: "user-check", timeoutSec: 10 },
        { type: "command", bash: "bun .aidlc/hooks/aidlc-copilot-adapter.ts example-guard", powershell: "bun .aidlc/hooks/aidlc-copilot-adapter.ts example-guard", timeoutSec: 30 },
      ] },
    });
    expect(plannedDocument({ result, path: ".aidlc/hooks/plugin-hook-targets.json" })).toEqual({ "user-guard": "user-guard.ts", "example-guard": "guard.ts" });
  });

  test("Cursor appends an event body after the user's existing body", () => {
    const result = selectedPlan({
      harness: "cursor",
      current: [{ kind: "event-body", path: ".cursor/hooks/plugin-hook-targets.json", event: "PreToolUse", hookFile: "guard.ts" }],
      documents: [{ path: ".cursor/hooks/plugin-hook-targets.json", text: '{"PreToolUse":["user-guard.ts"],"PostToolUse":["user-after.ts"]}' }],
    });
    expect(result.kind).toBe("planned");
    expect(plannedDocument({ result, path: ".cursor/hooks/plugin-hook-targets.json" })).toEqual({ PreToolUse: ["user-guard.ts", "guard.ts"], PostToolUse: ["user-after.ts"] });
  });

  test("OpenCode appends its complete row after existing user rows", () => {
    const result = selectedPlan({
      harness: "opencode",
      current: [{ kind: "event-row", path: ".aidlc/hooks/plugin-hook-rows.json", row: { event: "PreToolUse", target: "example-guard", hookFile: "guard.ts", pluginName: "example", matcher: "Bash" } }],
      documents: [{ path: ".aidlc/hooks/plugin-hook-rows.json", text: '[{"event":"PreToolUse","target":"user-guard","hookFile":"user.ts","pluginName":"user"}]' }],
    });
    expect(result.kind).toBe("planned");
    expect(plannedDocument({ result, path: ".aidlc/hooks/plugin-hook-rows.json" })).toEqual([
      { event: "PreToolUse", target: "user-guard", hookFile: "user.ts", pluginName: "user" },
      { event: "PreToolUse", target: "example-guard", hookFile: "guard.ts", pluginName: "example", matcher: "Bash" },
    ]);
  });

  test("an equal existing user registration is preserved without claiming ownership", () => {
    const result = selectedPlan({
      harness: "claude",
      current: [claudeContribution],
      documents: [{ path: ".claude/settings.json", text: '{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "bun .claude/hooks/guard.ts" }] }] } }\n' }],
    });
    expect(result).toEqual({
      kind: "planned",
      documents: [{ path: ".claude/settings.json", text: '{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "bun .claude/hooks/guard.ts" }] }] } }\n' }],
      ownedRegistrations: [],
    });
  });

  test("a missing recorded native group refuses deselection without adopting user rows", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example",
      harness: "claude",
      selection: { kind: "deselected" },
      previous: [claudeContribution],
      current: [],
      documents: [{ path: ".claude/settings.json", text: '{"hooks":{"PreToolUse":[{"hooks":[{"type":"command","command":"operator-edited"}]}]}}' }],
    });
    expect(result).toMatchObject({
      kind: "conflict",
      error: {
        kind: "hook-registration-conflict",
        pluginName: "example",
        path: ".claude/settings.json",
        reason: "missing-owned-value",
      },
    });
    expect(result).not.toHaveProperty("documents");
  });
});

describe("owned plugin hook registration lifecycle", () => {
  test("a modified owned Codex target refuses the whole registration plan", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "codex", selection: { kind: "deselected" },
      previous: [codexContribution, { kind: "target", path: ".codex/hooks/plugin-hook-targets.json", target: "example-guard", hookFile: "guard.ts" }], current: [],
      documents: [
        { path: ".codex/hooks.json", text: '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"bun .codex/tools/aidlc.ts engine adapter codex example-guard"}]}]}}' },
        { path: ".codex/hooks/plugin-hook-targets.json", text: '{"example-guard":"operator-edited.ts"}' },
      ],
    });
    expect(result).toMatchObject({ kind: "conflict", error: { path: ".codex/hooks/plugin-hook-targets.json", reason: "modified-owned-value" } });
    expect(result).not.toHaveProperty("documents");
  });

  test("a modified owned Cursor event body refuses without adopting the replacement", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "cursor", selection: { kind: "deselected" },
      previous: [{ kind: "event-body", path: ".cursor/hooks/plugin-hook-targets.json", event: "PreToolUse", hookFile: "guard.ts" }], current: [],
      documents: [{ path: ".cursor/hooks/plugin-hook-targets.json", text: '{"PreToolUse":["operator-edited.ts","user.ts"]}' }],
    });
    expect(result).toMatchObject({ kind: "conflict", error: { path: ".cursor/hooks/plugin-hook-targets.json", reason: "missing-owned-value" } });
    expect(result).not.toHaveProperty("documents");
  });

  test("a modified owned OpenCode row refuses without claiming the similar replacement", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "opencode", selection: { kind: "deselected" },
      previous: [{ kind: "event-row", path: ".aidlc/hooks/plugin-hook-rows.json", row: { event: "PreToolUse", target: "example-guard", hookFile: "guard.ts", pluginName: "example", matcher: "Bash" } }], current: [],
      documents: [{ path: ".aidlc/hooks/plugin-hook-rows.json", text: '[{"event":"PreToolUse","target":"example-guard","hookFile":"operator-edited.ts","pluginName":"example","matcher":"Bash"}]' }],
    });
    expect(result).toMatchObject({ kind: "conflict", error: { path: ".aidlc/hooks/plugin-hook-rows.json", reason: "missing-owned-value" } });
    expect(result).not.toHaveProperty("documents");
  });

  test("repeated selection preserves proven ownership and untouched document bytes", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "claude", selection: { kind: "selected" },
      previous: [claudeContribution], current: [claudeContribution],
      documents: [{ path: ".claude/settings.json", text: '{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "bun .claude/hooks/guard.ts" }] }] } }\n' }],
    });
    expect(result).toEqual({
      kind: "planned",
      documents: [{ path: ".claude/settings.json", text: '{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "bun .claude/hooks/guard.ts" }] }] } }\n' }],
      ownedRegistrations: [claudeContribution],
    });
  });

  test("renaming a Claude guard removes its prior group and preserves unrelated settings and groups", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "claude", selection: { kind: "selected" },
      previous: [claudeContribution],
      current: [{ kind: "group", path: ".claude/settings.json", event: "PreToolUse", group: { matcher: "Bash", hooks: [{ type: "command", command: "bun .claude/hooks/renamed-guard.ts" }] } }],
      documents: [{ path: ".claude/settings.json", text: '{"model":"consumer","hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"bun .claude/hooks/guard.ts"}]},{"hooks":[{"type":"command","command":"user-check"}]}]}}' }],
    });
    expect(result.kind).toBe("planned");
    expect(plannedDocument({ result, path: ".claude/settings.json" })).toEqual({
      model: "consumer", hooks: { PreToolUse: [
        { hooks: [{ type: "command", command: "user-check" }] },
        { matcher: "Bash", hooks: [{ type: "command", command: "bun .claude/hooks/renamed-guard.ts" }] },
      ] },
    });
  });

  test("disabling a Claude guard removes one owned occurrence and preserves an equal unrecorded duplicate", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "claude", selection: { kind: "deselected" },
      previous: [claudeContribution], current: [],
      documents: [{ path: ".claude/settings.json", text: '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"bun .claude/hooks/guard.ts"}]},{"matcher":"Bash","hooks":[{"type":"command","command":"bun .claude/hooks/guard.ts"}]}]}}' }],
    });
    expect(plannedDocument({ result, path: ".claude/settings.json" })).toEqual({
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "bun .claude/hooks/guard.ts" }] }] },
    });
    expect(result).toMatchObject({ kind: "planned", ownedRegistrations: [] });
  });

  test("disabling Codex removes the owned group and target while retaining user entries", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "codex", selection: { kind: "deselected" },
      previous: [codexContribution, { kind: "target", path: ".codex/hooks/plugin-hook-targets.json", target: "example-guard", hookFile: "guard.ts" }], current: [],
      documents: [
        { path: ".codex/hooks.json", text: '{"consumer":"retained","hooks":{"PreToolUse":[{"hooks":[{"type":"command","command":"user-check"}]},{"matcher":"Bash","hooks":[{"type":"command","command":"bun .codex/tools/aidlc.ts engine adapter codex example-guard"}]}]}}' },
        { path: ".codex/hooks/plugin-hook-targets.json", text: '{"user-guard":"user.ts","example-guard":"guard.ts"}' },
      ],
    });
    expect(plannedDocument({ result, path: ".codex/hooks.json" })).toEqual({ consumer: "retained", hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "user-check" }] }] } });
    expect(plannedDocument({ result, path: ".codex/hooks/plugin-hook-targets.json" })).toEqual({ "user-guard": "user.ts" });
  });

  test("disabling Copilot removes its owned flat host entry and leaves the user entry untouched", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "copilot", selection: { kind: "deselected" },
      previous: [copilotContribution], current: [],
      documents: [{ path: ".github/hooks/aidlc.json", text: '{"version":1,"hooks":{"PreToolUse":[{"type":"command","bash":"user-check","powershell":"user-check","timeoutSec":10},{"type":"command","bash":"bun .aidlc/hooks/aidlc-copilot-adapter.ts example-guard","powershell":"bun .aidlc/hooks/aidlc-copilot-adapter.ts example-guard","timeoutSec":30}]}}' }],
    });
    expect(plannedDocument({ result, path: ".github/hooks/aidlc.json" })).toEqual({ version: 1, hooks: { PreToolUse: [{ type: "command", bash: "user-check", powershell: "user-check", timeoutSec: 10 }] } });
  });

  test("renaming a Cursor event body removes only its owned prior body", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "cursor", selection: { kind: "selected" },
      previous: [{ kind: "event-body", path: ".cursor/hooks/plugin-hook-targets.json", event: "PreToolUse", hookFile: "guard.ts" }],
      current: [{ kind: "event-body", path: ".cursor/hooks/plugin-hook-targets.json", event: "PreToolUse", hookFile: "renamed.ts" }],
      documents: [{ path: ".cursor/hooks/plugin-hook-targets.json", text: '{"PreToolUse":["guard.ts","user.ts"],"PostToolUse":["user-after.ts"]}' }],
    });
    expect(plannedDocument({ result, path: ".cursor/hooks/plugin-hook-targets.json" })).toEqual({ PreToolUse: ["user.ts", "renamed.ts"], PostToolUse: ["user-after.ts"] });
  });

  test("disabling OpenCode removes only its complete recorded row", () => {
    const result = planPluginHookRegistrations({
      pluginName: "example", harness: "opencode", selection: { kind: "deselected" },
      previous: [{ kind: "event-row", path: ".aidlc/hooks/plugin-hook-rows.json", row: { event: "PreToolUse", target: "example-guard", hookFile: "guard.ts", pluginName: "example", matcher: "Bash" } }], current: [],
      documents: [{ path: ".aidlc/hooks/plugin-hook-rows.json", text: '[{"event":"PreToolUse","target":"example-guard","hookFile":"guard.ts","pluginName":"example","matcher":"Bash"},{"event":"PreToolUse","target":"user-guard","hookFile":"user.ts","pluginName":"user"}]' }],
    });
    expect(plannedDocument({ result, path: ".aidlc/hooks/plugin-hook-rows.json" })).toEqual([{ event: "PreToolUse", target: "user-guard", hookFile: "user.ts", pluginName: "user" }]);
  });
});


describe("project-specific Codex trust seed planning", () => {
  test("the final installed hook fields reach the canonical hash port", () => {
    const hashHook = mock((_hookRequest: CodexHookTrustIdentityInput) => "sha256:baf42fc38cc3a0b4bacdf6d17c88276c8d7aae2f728be8f46e291c93a866097e");
    const result = planCodexHookTrustSeed({
      document: { hooks: { PreToolUse: [{
        matcher: "Bash", hooks: [{ type: "command", command: "bun .codex/tools/aidlc.ts engine adapter codex rin-block-inline-exec" }],
      }] } },
      hooksPath: "/consumer/.codex/hooks.json", hashHook,
    });
    expect(hashHook.mock.calls).toEqual([[{
      eventSnake: "pre_tool_use", command: "bun .codex/tools/aidlc.ts engine adapter codex rin-block-inline-exec", matcher: "Bash", timeout: undefined,
    }]]);
    expect(result).toEqual({
      kind: "planned",
      text: '[hooks.state."/consumer/.codex/hooks.json:pre_tool_use:0:0"]\ntrusted_hash = "sha256:baf42fc38cc3a0b4bacdf6d17c88276c8d7aae2f728be8f46e291c93a866097e"\n',
    });
  });

  test("each handler preserves its final group and handler index", () => {
    const hashHook = mock((_hookRequest: CodexHookTrustIdentityInput) => "first").mockReturnValueOnce("first").mockReturnValueOnce("second").mockReturnValueOnce("third");
    const result = planCodexHookTrustSeed({
      document: { hooks: { PostToolUse: [
        { matcher: "Read", hooks: [{ type: "command", command: "one" }, { type: "command", command: "two" }] },
        { matcher: "Write", hooks: [{ type: "command", command: "three" }] },
      ] } },
      hooksPath: "/consumer/.codex/hooks.json", hashHook,
    });
    expect(hashHook.mock.calls).toEqual([
      [{ eventSnake: "post_tool_use", command: "one", matcher: "Read", timeout: undefined }],
      [{ eventSnake: "post_tool_use", command: "two", matcher: "Read", timeout: undefined }],
      [{ eventSnake: "post_tool_use", command: "three", matcher: "Write", timeout: undefined }],
    ]);
    expect(result).toEqual({
      kind: "planned",
      text: '[hooks.state."/consumer/.codex/hooks.json:post_tool_use:0:0"]\ntrusted_hash = "first"\n\n[hooks.state."/consumer/.codex/hooks.json:post_tool_use:0:1"]\ntrusted_hash = "second"\n\n[hooks.state."/consumer/.codex/hooks.json:post_tool_use:1:0"]\ntrusted_hash = "third"\n',
    });
  });

  test("an invalid matcher refuses before invoking the hash port", () => {
    const hashHook = mock((_hookRequest: CodexHookTrustIdentityInput) => "unused");
    expect(planCodexHookTrustSeed({
      document: { hooks: { PreToolUse: [{ matcher: 7, hooks: [{ type: "command", command: "guard" }] }] } },
      hooksPath: "/consumer/.codex/hooks.json", hashHook,
    })).toEqual({ kind: "invalid-document" });
    expect(hashHook).not.toHaveBeenCalled();
  });
  test("an explicit timeout reaches the canonical hash capability unchanged", () => {
    const hashHook = mock((_hookRequest: CodexHookTrustIdentityInput) => "compound");
    const result = planCodexHookTrustSeed({
      document: { hooks: { Stop: [{ hooks: [{ type: "command", command: "stop", timeout: 3600 }] }] } },
      hooksPath: "/consumer/.codex/hooks.json", hashHook,
    });
    expect(hashHook.mock.calls).toEqual([[{ eventSnake: "stop", command: "stop", matcher: undefined, timeout: 3600 }]]);
    expect(result).toEqual({ kind: "planned", text: '[hooks.state."/consumer/.codex/hooks.json:stop:0:0"]\ntrusted_hash = "compound"\n' });
  });

  test("an invalid timeout refuses before invoking the hash capability", () => {
    const hashHook = mock((_hookRequest: CodexHookTrustIdentityInput) => "unused");
    expect(planCodexHookTrustSeed({
      document: { hooks: { Stop: [{ hooks: [{ type: "command", command: "stop", timeout: -1 }] }] } },
      hooksPath: "/consumer/.codex/hooks.json", hashHook,
    })).toEqual({ kind: "invalid-document" });
    expect(hashHook).not.toHaveBeenCalled();
  });

});
