import { expect, test } from "bun:test";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { codexHostIdentity, CODEX_HOST_DATA, CODEX_TOKENS, CODEX_AUTHORED_PLACEMENTS } from "./host-data.ts";

test("Codex declares its exact native runtime facts", () => {
  expect(CODEX_HOST_DATA).toEqual({
  "productName": "Codex CLI",
  "statusLine": {
    "items": [
      "model-with-reasoning",
      "git-branch",
      "task-progress",
      "context-used"
    ]
  },
  "configNextStep": "run `codex` (when it asks about hooks, choose Trust all and continue), then `$aidlc --doctor`",
  "hookActivation": {
    "recovery": "In Codex, type /hooks, press t to trust all, then press Esc. Then carry on in the same chat.",
    "notRunYet": "This is expected before your first Codex chat in this folder. If you already started one, type /hooks in Codex, press t to trust all, then press Esc, and run doctor again.",
    "agentStep": "Codex has not been allowed to run this project's AI-DLC steps. Only the person can allow it, inside Codex: do not edit any Codex config and do not restart Codex. Their next message counts in this same chat. Show the person this line and end your turn: \"In Codex, type /hooks, press t to trust all, then press Esc. Then carry on here.\"",
    "startedInsideProject": "AI-DLC's hooks work only when Codex is started in the project folder. Exit Codex, start it again in <folder>, then type <entry>."
  },
  "hostShell": {
    "env": [
      "CODEX_SESSION_ID",
      "CODEX_THREAD_ID"
    ]
  },
  "newChatStep": {
    "text": "open a new chat, then type <entry>"
  },
  "rulesFolder": "aidlc-rules"
});
});

test("Codex declares five-option questions and the existing invocation token choice", () => {
  expect(CODEX_TOKENS).toEqual({ ["SKILL_INVOKE"]: null, ["OPTION_LETTERS"]: "A-E" });
});

test("Codex owns its adapter and project-root gitignore placements", () => {
  expect(CODEX_AUTHORED_PLACEMENTS).toEqual([
    { source: "hooks/aidlc-codex-adapter.ts", destination: ".codex/hooks/aidlc-codex-adapter.ts" },
    { source: "dot-gitignore", destination: ".gitignore" },
  ]);
});

test("Codex owns its checked distribution identity and native directory", () => {
  expect(codexHostIdentity()).toEqual({ ok: true, value: host({ name: "codex", directory: ".codex" }) });
});
