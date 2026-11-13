import { accept } from "../../../kernel/fixtures/accept.ts";
import { refused } from "../../../kernel/result.ts";
import { path } from "../../../kernel/fixtures/values.fixture.ts";
import { expect, mock, test } from "bun:test";
import { createCodexSettingsRenderer, emitDefaultRules, emitTrustSeed, trustEntries } from "./settings-renderer.ts";
import { settingsRenderingInputsFixture } from "../../../projection/fixtures/settings-rendering.fixture.ts";
import { methodSliceFixture } from "../../../workflow-definition/fixtures/method.fixture.ts";
import type { HookTrustHash } from "../../../projection/application/ports/settings.ts";
const inputs = settingsRenderingInputsFixture({ harnessDir: ".codex", files: [] });
const legacy = { extendedSubprocessTimeoutMs: 12000, hookTrust: ({ event, command, timeoutSeconds, matcher }: { event: string; command: string; timeoutSeconds: number; matcher: string | undefined }) => JSON.stringify([event, command, timeoutSeconds, matcher ?? null]) };

test("copy rules preserve literal retained bytes and injected tool scripts", () => {
  expect(createCodexSettingsRenderer({ ...inputs, ...legacy }).renderSettings({ method: methodSliceFixture })).toEqual({
  "ok": true,
  "value": [
    {
      "path": path(".codex/rules/default.rules"),
      "content": {
        "kind": "text",
        "text": "# dist/codex shipped permission rules (Starlark) — .codex/rules/ is\n# Codex's NATIVE rules dir (this file), distinct from the AIDLC markdown rule\n# layers at .codex/aidlc-rules/ (D-10 rename).\n#\n# Bun copy-channel allowlist: AI-DLC's engine commands and its tool scripts.\nprefix_rule(pattern = [\"bun\", \".codex/tools/aidlc.ts\", \"aidlc\"], decision = \"allow\")\nprefix_rule(pattern = [\"bun\", [\n    \".codex/tools/aidlc-graph.ts\",\n    \".codex/tools/aidlc-utility.ts\"\n]], decision = \"allow\")\n\n# Git allow-rules (S9d): workspace-write keeps .git read-only in-sandbox and\n# routes git writes through escalation; these prefix rules pre-approve the\n# retry-unsandboxed step so Bolt worktree/commit flows run friction-free.\nprefix_rule(pattern = [\"git\", \"worktree\"], decision = \"allow\")\nprefix_rule(pattern = [\"git\", \"commit\"], decision = \"allow\")\nprefix_rule(pattern = [\"git\", \"add\"], decision = \"allow\")\n"
      },
      "mode": "regular",
      "origin": {
        "kind": "rendered",
        "concept": "settings",
        "name": "rules/default.rules"
      }
    }
  ]
});
});
test("native channel selects binary rules even with a copy invocation token", () => {
  expect(createCodexSettingsRenderer({ ...inputs, ...legacy, channel: "native" }).renderSettings({method: methodSliceFixture})).toEqual({
  "ok": true,
  "value": [
    {
      "path": path(".codex/rules/default.rules"),
      "content": {
        "kind": "text",
        "text": "# dist/codex shipped permission rules (Starlark) — .codex/rules/ is\n# Codex's NATIVE rules dir (this file), distinct from the AIDLC markdown rule\n# layers at .codex/aidlc-rules/ (D-10 rename).\n#\n# Native runtime allowlist: framework commands invoke the self-contained binary.\nprefix_rule(pattern = [\"aidlc\", \"aidlc\"], decision = \"allow\")\n\n# Git allow-rules (S9d): workspace-write keeps .git read-only in-sandbox and\n# routes git writes through escalation; these prefix rules pre-approve the\n# retry-unsandboxed step so Bolt worktree/commit flows run friction-free.\nprefix_rule(pattern = [\"git\", \"worktree\"], decision = \"allow\")\nprefix_rule(pattern = [\"git\", \"commit\"], decision = \"allow\")\nprefix_rule(pattern = [\"git\", \"add\"], decision = \"allow\")\n"
      },
      "mode": "regular",
      "origin": {
        "kind": "rendered",
        "concept": "settings",
        "name": "rules/default.rules"
      }
    }
  ]
});
});
test("hooks and trust seed preserve literal retained bytes, ordering, matchers and budgets", () => {
  expect(createCodexSettingsRenderer({ ...inputs, ...legacy }).renderHookRegistrations({hooks: []})).toEqual({
  "ok": true,
  "value": [
    {
      "path": path(".codex/hooks.json"),
      "content": {
        "kind": "text",
        "text": "{\n  \"hooks\": {\n    \"SessionStart\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex session-start\",\n            \"timeout\": 12\n          }\n        ]\n      }\n    ],\n    \"UserPromptSubmit\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex record-human-turn\",\n            \"timeout\": 12\n          }\n        ]\n      }\n    ],\n    \"PreToolUse\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex guard-tool-call\",\n            \"timeout\": 12\n          }\n        ]\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex deliver-stage-rules\",\n            \"timeout\": 12\n          }\n        ],\n        \"matcher\": \"spawn_agent\"\n      }\n    ],\n    \"PostToolUse\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex record-human-turn\",\n            \"timeout\": 12\n          }\n        ],\n        \"matcher\": \"request_user_input\"\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex audit-and-sensors\",\n            \"timeout\": 24\n          }\n        ],\n        \"matcher\": \"apply_patch\"\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex sync-workflow-state\",\n            \"timeout\": 12\n          }\n        ],\n        \"matcher\": \"update_plan\"\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex rebuild-stage-graph\",\n            \"timeout\": 12\n          }\n        ],\n        \"matcher\": \"Bash\"\n      }\n    ],\n    \"PreCompact\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex validate-state\",\n            \"timeout\": 12\n          }\n        ]\n      }\n    ],\n    \"SubagentStop\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex log-subagent\",\n            \"timeout\": 12\n          }\n        ]\n      }\n    ],\n    \"Stop\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"bun .codex/tools/aidlc.ts aidlc adapter codex continue-workflow\",\n            \"timeout\": 24\n          }\n        ]\n      }\n    ]\n  }\n}\n"
      },
      "mode": "regular",
      "origin": {
        "kind": "rendered",
        "concept": "hook-registration",
        "name": "hooks.json"
      }
    },
    {
      "path": path(".codex/trust-seed.toml"),
      "content": {
        "kind": "text",
        "text": "# dist/codex hook-trust pre-seed (S9a) — TEMPLATE.\n# This template hashes the projected `bun .codex/tools/aidlc.ts aidlc adapter codex ...`\n# commands in hooks.json. Start one interactive Codex session and choose\n# \"Trust all and continue\" to register the project-specific hook identities.\n# Paste the complete stdout into the USER config.toml ($CODEX_HOME/config.toml).\n# If entries for that hooks.json path already exist, replace the full set;\n# appending a second set creates invalid TOML. The hash covers the\n# normalized hook identity (event + matcher + command + defaults), NOT the path;\n# only the key changes per install. Codex then runs the hooks without a\n# TUI trust pass (the --dangerously-bypass-hook-trust flag does NOT fire\n# untrusted hooks at 0.137-0.139; never rely on it).\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:session_start:0:0\"]\ntrusted_hash = \"[\\\"session_start\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex session-start\\\",12,null]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:user_prompt_submit:0:0\"]\ntrusted_hash = \"[\\\"user_prompt_submit\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex record-human-turn\\\",12,null]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:pre_tool_use:0:0\"]\ntrusted_hash = \"[\\\"pre_tool_use\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex guard-tool-call\\\",12,null]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:pre_tool_use:1:0\"]\ntrusted_hash = \"[\\\"pre_tool_use\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex deliver-stage-rules\\\",12,\\\"spawn_agent\\\"]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:0:0\"]\ntrusted_hash = \"[\\\"post_tool_use\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex record-human-turn\\\",12,\\\"request_user_input\\\"]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:1:0\"]\ntrusted_hash = \"[\\\"post_tool_use\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex audit-and-sensors\\\",24,\\\"apply_patch\\\"]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:2:0\"]\ntrusted_hash = \"[\\\"post_tool_use\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex sync-workflow-state\\\",12,\\\"update_plan\\\"]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:3:0\"]\ntrusted_hash = \"[\\\"post_tool_use\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex rebuild-stage-graph\\\",12,\\\"Bash\\\"]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:pre_compact:0:0\"]\ntrusted_hash = \"[\\\"pre_compact\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex validate-state\\\",12,null]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:subagent_stop:0:0\"]\ntrusted_hash = \"[\\\"subagent_stop\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex log-subagent\\\",12,null]\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:stop:0:0\"]\ntrusted_hash = \"[\\\"stop\\\",\\\"bun .codex/tools/aidlc.ts aidlc adapter codex continue-workflow\\\",24,null]\"\n"
      },
      "mode": "regular",
      "origin": {
        "kind": "rendered",
        "concept": "hook-registration",
        "name": "trust-seed.toml"
      }
    }
  ]
});
});
test("a missing namespace refuses the whole hook registration member", () => {
  expect(createCodexSettingsRenderer({ ...inputs, ...legacy,
    tokens: { ...inputs.tokens, ["TRUSTED_NAMESPACE"]: null },
  }).renderHookRegistrations({ hooks: [] })).toEqual({ ok: false, refusal: {
    kind: "render-failed", concept: "hook-registration", name: "hooks.json",
    reason: "trusted route namespace, invocation and harness directory are required",
  } });
});
test("the compatibility rules entry propagates the allow-source refusal unchanged", () => {
  expect(emitDefaultRules({ harnessDir: ".codex", invoke: "aidlc", trustedNamespace: "aidlc" },
    { ok: false, refusal: { kind: "render-failed", concept: "settings", name: "copy-channel-allows", reason: "allow source failed" } }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "settings", name: "copy-channel-allows", reason: "allow source failed" } });
});
test("the trust entry owns the retained missing-namespace failure fact", () => {
  expect(trustEntries({ hooksJsonPath: "C:\\project\\.codex\\hooks.json", harnessName: "codex", invoke: "aidlc", trustedNamespace: undefined }, legacy))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "hook-registration", name: "hooks.json", reason: "trusted route namespace is required" } });
});
test("the seed propagates the trust entry namespace refusal", () => {
  expect(emitTrustSeed({ harnessDir: ".codex", harnessName: "codex", invoke: "aidlc", trustedNamespace: undefined }, legacy))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "hook-registration", name: "hooks.json", reason: "trusted route namespace is required" } });
});
test("the published hook-trust capability failure stays a typed rendering refusal", () => {
  const hookTrust = mock(() => accept<string, string>(refused("trust hashing failed")));
  expect(createCodexSettingsRenderer({ ...inputs, hookTrust })
    .renderHookRegistrations({ hooks: [] })).toEqual({
    ok: false, refusal: { kind: "render-failed", concept: "hook-registration",
      name: "hooks.json", reason: 'Fixture value refused: "trust hashing failed"' },
  });
  expect(hookTrust).toHaveBeenCalledTimes(1);
});

test("settings refuse a missing captured harness directory", () => {
  expect(createCodexSettingsRenderer({ ...inputs,
    tokens: { ...inputs.tokens, ["HARNESS_DIR"]: null },
  }).renderSettings({ method: methodSliceFixture })).toEqual({
    ok: false, refusal: { kind: "render-failed", concept: "settings",
      name: "rules/default.rules", reason: "trusted route namespace and harness directory are required" },
  });
});


test("native hooks and trust seed preserve release literals and pass every exact identity to the hash port", () => {
  const hookTrust = mock<HookTrustHash>(() => "native-hook-trust");
  const native = createCodexSettingsRenderer({ ...inputs, channel: "native", extendedSubprocessTimeoutMs: 1_800_000,
    tokens: { ...inputs.tokens, ["INVOKE"]: "aidlc", ["TOOL_PREFIX"]: "aidlc ", ["TRUSTED_NAMESPACE"]: "engine" }, hookTrust });
  expect(native.renderHookRegistrations({ hooks: [] })).toEqual({
  "ok": true,
  "value": [
    {
      "path": path(".codex/hooks.json"),
      "content": {
        "kind": "text",
        "text": "{\n  \"hooks\": {\n    \"SessionStart\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex session-start\",\n            \"timeout\": 1800\n          }\n        ]\n      }\n    ],\n    \"UserPromptSubmit\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex record-human-turn\",\n            \"timeout\": 1800\n          }\n        ]\n      }\n    ],\n    \"PreToolUse\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex guard-tool-call\",\n            \"timeout\": 1800\n          }\n        ]\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex deliver-stage-rules\",\n            \"timeout\": 1800\n          }\n        ],\n        \"matcher\": \"spawn_agent\"\n      }\n    ],\n    \"PostToolUse\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex record-human-turn\",\n            \"timeout\": 1800\n          }\n        ],\n        \"matcher\": \"request_user_input\"\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex audit-and-sensors\",\n            \"timeout\": 3600\n          }\n        ],\n        \"matcher\": \"apply_patch\"\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex sync-workflow-state\",\n            \"timeout\": 1800\n          }\n        ],\n        \"matcher\": \"update_plan\"\n      },\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex rebuild-stage-graph\",\n            \"timeout\": 1800\n          }\n        ],\n        \"matcher\": \"Bash\"\n      }\n    ],\n    \"PreCompact\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex validate-state\",\n            \"timeout\": 1800\n          }\n        ]\n      }\n    ],\n    \"SubagentStop\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex log-subagent\",\n            \"timeout\": 1800\n          }\n        ]\n      }\n    ],\n    \"Stop\": [\n      {\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"aidlc engine adapter codex continue-workflow\",\n            \"timeout\": 3600\n          }\n        ]\n      }\n    ]\n  }\n}\n"
      },
      "mode": "regular",
      "origin": {
        "kind": "rendered",
        "concept": "hook-registration",
        "name": "hooks.json"
      }
    },
    {
      "path": path(".codex/trust-seed.toml"),
      "content": {
        "kind": "text",
        "text": "# dist/codex hook-trust pre-seed (S9a) \u2014 TEMPLATE.\n# This template hashes the projected `aidlc engine adapter codex ...`\n# commands in hooks.json. Start one interactive Codex session and choose\n# \"Trust all and continue\" to register the project-specific hook identities.\n# Paste the complete stdout into the USER config.toml ($CODEX_HOME/config.toml).\n# If entries for that hooks.json path already exist, replace the full set;\n# appending a second set creates invalid TOML. The hash covers the\n# normalized hook identity (event + matcher + command + defaults), NOT the path;\n# only the key changes per install. Codex then runs the hooks without a\n# TUI trust pass (the --dangerously-bypass-hook-trust flag does NOT fire\n# untrusted hooks at 0.137-0.139; never rely on it).\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:session_start:0:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:user_prompt_submit:0:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:pre_tool_use:0:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:pre_tool_use:1:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:0:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:1:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:2:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:post_tool_use:3:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:pre_compact:0:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:subagent_stop:0:0\"]\ntrusted_hash = \"native-hook-trust\"\n\n[hooks.state.\"<PROJECT_DIR>/.codex/hooks.json:stop:0:0\"]\ntrusted_hash = \"native-hook-trust\"\n"
      },
      "mode": "regular",
      "origin": {
        "kind": "rendered",
        "concept": "hook-registration",
        "name": "trust-seed.toml"
      }
    }
  ]
});
  expect(hookTrust.mock.calls).toEqual([
    [{ event: "session_start", command: "aidlc engine adapter codex session-start",
      timeoutSeconds: 1800, matcher: undefined }],
    [{ event: "user_prompt_submit", command: "aidlc engine adapter codex record-human-turn",
      timeoutSeconds: 1800, matcher: undefined }],
    [{ event: "pre_tool_use", command: "aidlc engine adapter codex guard-tool-call",
      timeoutSeconds: 1800, matcher: undefined }],
    [{ event: "pre_tool_use", command: "aidlc engine adapter codex deliver-stage-rules",
      timeoutSeconds: 1800, matcher: "spawn_agent" }],
    [{ event: "post_tool_use", command: "aidlc engine adapter codex record-human-turn",
      timeoutSeconds: 1800, matcher: "request_user_input" }],
    [{ event: "post_tool_use", command: "aidlc engine adapter codex audit-and-sensors",
      timeoutSeconds: 3600, matcher: "apply_patch" }],
    [{ event: "post_tool_use", command: "aidlc engine adapter codex sync-workflow-state",
      timeoutSeconds: 1800, matcher: "update_plan" }],
    [{ event: "post_tool_use", command: "aidlc engine adapter codex rebuild-stage-graph",
      timeoutSeconds: 1800, matcher: "Bash" }],
    [{ event: "pre_compact", command: "aidlc engine adapter codex validate-state",
      timeoutSeconds: 1800, matcher: undefined }],
    [{ event: "subagent_stop", command: "aidlc engine adapter codex log-subagent",
      timeoutSeconds: 1800, matcher: undefined }],
    [{ event: "stop", command: "aidlc engine adapter codex continue-workflow",
      timeoutSeconds: 3600, matcher: undefined }]
  ]);
});
