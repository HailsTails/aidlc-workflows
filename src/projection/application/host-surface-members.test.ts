import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { claudeHostDataFixture, AUTHORED_PLACEMENTS_FIXTURE } from "../fixtures/host-data.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import { createHostSurfaceMembers } from "./host-surface-members.ts";

const claude = host({ name: "claude", directory: ".claude" });
const tokens = tokenBindingsFixture({ harnessDir: ".claude" });
const request = { host: claude, data: claudeHostDataFixture, placements: AUTHORED_PLACEMENTS_FIXTURE,
  tokens, channel: "copy", prepare: accepted } as const;

const claudeDescriptor = `{
  "schemaVersion": 1,
  "distribution": "claude",
  "productName": "Claude Code",
  "configNextStep": "open Claude Code in this project and run \u0060/aidlc --doctor\u0060",
  "name": "claude",
  "harnessDir": ".claude",
  "rulesSubdir": "rules",
  "runnerFrontmatterAdditions": [
    "disable-model-invocation: true"
  ],
  "hookActivation": {
    "recovery": "Run bun .claude/tools/aidlc.ts doctor, then start Claude Code again in <folder>.",
    "missesReplies": true,
    "registration": {
      "file": ".claude/settings.json",
      "missing": "The hook registration is missing.",
      "invalid": "The hook registration is not valid JSON.",
      "unwired": "A hook is not wired."
    }
  },
  "statusLine": {
    "type": "command",
    "command": "bun \\"$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts\\" engine statusline"
  },
  "agentFinishRecorded": {
    "env": [
      "CLAUDE_CODE_SESSION_ID"
    ]
  },
  "hostShell": {
    "env": [
      "CLAUDECODE",
      "CLAUDE_CODE_SESSION_ID"
    ]
  }
}
`;

test("host data retains exact key order and formatting while binding only hook strings", () => {
  expect(createHostSurfaceMembers(request).renderHostData()).toEqual(accepted([{
    path: path(".claude/tools/data/harness.json"), content: { kind: "text", text: claudeDescriptor },
    mode: "regular", availability: "always",
    origin: { kind: "rendered", concept: "host-data", name: "claude" },
  }]));
});

test("plugin frontmatter selects the requested channel and stays outside harness.json", () => {
  expect(createHostSurfaceMembers({ ...request, channel: "native",
    data: { productName: "Scratch", configNextStep: "Keep {{INVOKE}}", rulesFolder: "steering",
      runnerFrontmatterAdditions: [], pluginAgentFrontmatter: { copy: ["copy"], native: ["native"] } },
  }).renderHostData()).toEqual(accepted([
    { path: path(".claude/tools/data/harness.json"), content: { kind: "text", text: `{
  "schemaVersion": 1,
  "distribution": "claude",
  "productName": "Scratch",
  "configNextStep": "Keep {{INVOKE}}",
  "name": "claude",
  "harnessDir": ".claude",
  "rulesSubdir": "steering"
}
` }, mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "claude" } },
    { path: path(".claude/tools/data/plugin-agent.md"), content: { kind: "text", text: "---\nnative\n---\n" },
      mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "claude" } },
  ]));
});

test("authored placement keeps prepared binary bytes and authored provenance", () => {
  expect(createHostSurfaceMembers({ ...request,
    prepare: (file) => accepted({ ...file, content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } }),
  }).placeAuthoredFile({ file: { source: source("dot-gitignore"),
    content: { kind: "text", text: "Captured {{INVOKE}}" } } })).toEqual(accepted([{
      path: path(".gitignore"), content: { kind: "bytes", bytes: new Uint8Array([0, 255]) },
      mode: "regular", availability: "always",
      origin: { kind: "harness-authored", source: source("dot-gitignore") },
    }]));
});

test("a missing placement names its actual source before preparation", () => {
  const prepare = mock(accepted);
  expect(createHostSurfaceMembers({ ...request, prepare }).placeAuthoredFile({
    file: { source: source("unplaced.md"), content: { kind: "text", text: "Captured" } },
  })).toEqual(refused({ kind: "render-failed", concept: "host-data", name: "unplaced.md",
    reason: "The authored host file has no declared placement." }));
  expect(prepare).not.toHaveBeenCalled();
});

test("a destination outside the project is refused before preparation", () => {
  const prepare = mock(accepted);
  expect(createHostSurfaceMembers({ ...request, prepare,
    placements: [{ source: "dot-gitignore", destination: "../escape" }],
  }).placeAuthoredFile({ file: { source: source("dot-gitignore"),
    content: { kind: "text", text: "Captured" } } })).toEqual(refused({
      kind: "render-failed", concept: "host-data", name: "dot-gitignore",
      reason: "The authored destination must be project-relative.",
    }));
  expect(prepare).not.toHaveBeenCalled();
});

test("a preparation refusal remains the original source refusal", () => {
  expect(createHostSurfaceMembers({ ...request, prepare: () => refused({
    kind: "host-source-unreadable", host: claude, source: source("dot-gitignore"), reason: "Unusable source",
  }) }).placeAuthoredFile({ file: { source: source("dot-gitignore"),
    content: { kind: "text", text: "Captured" } } })).toEqual(refused({
      kind: "host-source-unreadable", host: claude, source: source("dot-gitignore"), reason: "Unusable source",
    }));
});
test("nested hook strings escape safely while new-chat text stays in its declared form", () => {
  expect(createHostSurfaceMembers({ ...request,
    tokens: { ...tokens, ["INVOKE"]: 'aidlc "quoted"' },
    data: { productName: "Scratch", configNextStep: "Keep {{INVOKE}}", rulesFolder: null,
      hookActivation: { recovery: "{{INVOKE}}", agentStepInHost: {
        env: ["{{TOOL_PREFIX}}"], text: "{{TRUSTED_NAMESPACE}}" } },
      newChatStep: { text: "{{INVOKE}}", inHost: { env: ["native"], text: "{{INVOKE}}" } } },
  }).renderHostData()).toEqual(accepted([{
    path: path(".claude/tools/data/harness.json"), mode: "regular", availability: "always",
    origin: { kind: "rendered", concept: "host-data", name: "claude" },
    content: { kind: "text", text: `{
  "schemaVersion": 1,
  "distribution": "claude",
  "productName": "Scratch",
  "configNextStep": "Keep {{INVOKE}}",
  "name": "claude",
  "harnessDir": ".claude",
  "rulesSubdir": "rules",
  "hookActivation": {
    "recovery": "aidlc \\"quoted\\"",
    "agentStepInHost": {
      "env": [
        "bun .claude/tools/"
      ],
      "text": "aidlc"
    }
  },
  "newChatStep": {
    "text": "{{INVOKE}}",
    "inHost": {
      "env": [
        "native"
      ],
      "text": "{{INVOKE}}"
    }
  }
}
` },
  }]));
});