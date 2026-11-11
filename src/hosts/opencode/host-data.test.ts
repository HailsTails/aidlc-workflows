import { expect, test } from "bun:test";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { openCodeHostIdentity, OPENCODE_HOST_DATA, OPENCODE_TOKENS, OPENCODE_AUTHORED_PLACEMENTS } from "./host-data.ts";

test("OpenCode declares its exact native runtime facts", () => {
  expect(OPENCODE_HOST_DATA).toEqual({
  "productName": "opencode",
  "configNextStep": "run `opencode`, then `/aidlc --doctor`",
  "hookActivation": {
    "recovery": "Quit opencode and start it again with just `opencode` in <folder>, then type <entry> to carry on.",
    "notRunYet": "This is expected before your first opencode chat in this folder. If you already started one, quit opencode and start it again with just `opencode` in <folder>, then run doctor again.",
    "agentStep": "AI-DLC's opencode plugin is not loaded in this session. Do not retry and do not ask the person to answer again. Show the person this line and end your turn: \"Quit opencode and start it again with just `opencode` in <folder>, then type <entry> to carry on.\""
  },
  "hostShell": {
    "env": [
      "OPENCODE"
    ]
  },
  "newChatStep": {
    "text": "start a new session, then type <entry>"
  },
  "rulesFolder": null
});
});

test("OpenCode declares five-option questions and the existing invocation token choice", () => {
  expect(OPENCODE_TOKENS).toEqual({ ["SKILL_INVOKE"]: null, ["OPTION_LETTERS"]: "A-E" });
});

test("OpenCode places its gitignore at the project root and its entry command in the native directory", () => {
  expect(OPENCODE_AUTHORED_PLACEMENTS).toEqual([
    { source: "dot-gitignore", destination: ".gitignore" },
    { source: "command/aidlc.md", destination: ".opencode/command/aidlc.md" },
  ]);
});

test("OpenCode owns its checked distribution identity and native directory", () => {
  expect(openCodeHostIdentity()).toEqual({ ok: true, value: host({ name: "opencode", directory: ".aidlc" }) });
});
