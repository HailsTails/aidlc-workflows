import { expect, test } from "bun:test";
import { KIRO_IDE_HOST_DATA, KIRO_IDE_TOKENS, KIRO_IDE_AUTHORED_PLACEMENTS } from "./host-data.ts";

test("Kiro IDE declares its native runtime facts", () => {
  expect(KIRO_IDE_HOST_DATA).toEqual({
  "productName": "Kiro",
  "configNextStep": "open this project in Kiro IDE; if the Restricted Mode banner shows at the top of the window and you know what is in this folder, select Manage on it, then Trust; run `Developer: Reload Window` from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), choose the aidlc agent in the chat panel's agent picker, then run `/aidlc --doctor` (in Kiro CLI, start `kiro-cli --v3` in the project instead; if Kiro asks whether you trust this workspace and you know what is in this folder, choose \"Trust, continue\"; then run `/aidlc --doctor`)",
  "hookActivation": {
    "recovery": "In Kiro IDE, trust this folder: choose Trust Folder & Continue when Kiro asks whether you trust it, or select Manage on the Restricted Mode banner, then Trust. Then run Developer: Reload Window from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), and say carry on. In Kiro CLI, quit Kiro and start `kiro-cli --v3` again in this folder (if Kiro asks whether you trust this workspace and you know what is in this folder, choose 'Trust, continue'), then type <entry> to carry on. If you drive Kiro from an ACP client, the Kiro IDE guide names what that client must send.",
    "missedReply": "If the person already replied, that reply was not recorded. Do not ask them to answer again now. Tell them exactly this, with nothing about why, then only the line below for the tool they are in: \"Your answer was not recorded, so you may be asked for it again.\" In Kiro CLI, quit Kiro and start `kiro-cli --v3` again in this folder (if Kiro asks whether you trust this workspace and you know what is in this folder, choose 'Trust, continue'). If you drive Kiro from an ACP client, the Kiro IDE guide names what that client must send.",
    "missedReplyInHost": {
      "env": [
        "TERM_PROGRAM=kiro",
        "VSCODE_IPC_HOOK",
        "VSCODE_PID"
      ],
      "text": "If the person already replied, that reply was not recorded. Do not ask them to answer again now. Tell them exactly this, with nothing about why: \"Your answer was not recorded, so you may be asked for it again. In Kiro IDE, trust this folder: choose Trust Folder & Continue when Kiro asks whether you trust it, or select Manage on the Restricted Mode banner, then Trust. Then run Developer: Reload Window from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), and say carry on.\""
    },
    "notRunYet": "This is expected before your first chat message here. If you already sent one, trust this folder in Kiro IDE: choose Trust Folder & Continue when Kiro asks whether you trust it, or select Manage on the Restricted Mode banner, then Trust. Then run Developer: Reload Window from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), send a message and run doctor again. If AI-DLC was installed while Kiro IDE was open, quit Kiro IDE fully and reopen it instead: it keeps the PATH it started with, so its hooks cannot find aidlc, and Reload Window does not change that. In Kiro CLI, quit Kiro and start `kiro-cli --v3` again in this folder (if Kiro asks whether you trust this workspace and you know what is in this folder, choose 'Trust, continue').",
    "notRunYetCliFirst": {
      "env": [
        "TERM_PROGRAM=kiro",
        "VSCODE_IPC_HOOK",
        "VSCODE_PID"
      ],
      "text": "This is expected before your first chat message here. If you already sent one in Kiro CLI, quit Kiro and start `kiro-cli --v3` again in this folder (if Kiro asks whether you trust this workspace and you know what is in this folder, choose 'Trust, continue'), then send a message and run doctor again. If you sent it in Kiro IDE, trust this folder there: choose Trust Folder & Continue when Kiro asks whether you trust it, or select Manage on the Restricted Mode banner, then Trust. Then run Developer: Reload Window from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), send a message and run doctor again. If AI-DLC was installed while Kiro IDE was open, quit Kiro IDE fully and reopen it instead: it keeps the PATH it started with, so its hooks cannot find aidlc, and Reload Window does not change that."
    },
    "agentStep": "Kiro is not running AI-DLC's hooks in this folder. You cannot change that from inside the chat: do not approve, retry, or ask the person to answer again. Show the person this line: \"In Kiro CLI, quit Kiro and start `kiro-cli --v3` again in this folder (if Kiro asks whether you trust this workspace and you know what is in this folder, choose 'Trust, continue'), then type <entry> to carry on. If you drive Kiro from an ACP client, the Kiro IDE guide names what that client must send.\" Then end your turn.",
    "agentStepInHost": {
      "env": [
        "TERM_PROGRAM=kiro",
        "VSCODE_IPC_HOOK",
        "VSCODE_PID"
      ],
      "text": "Kiro is not running AI-DLC's hooks in this folder. You cannot change that from inside the chat: do not approve, retry, or ask the person to answer again. Show the person this line: \"In Kiro IDE, trust this folder: choose Trust Folder & Continue when Kiro asks whether you trust it, or select Manage on the Restricted Mode banner, then Trust. Then run Developer: Reload Window from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), and say carry on.\" Then end your turn."
    }
  },
  "hostShell": {
    "env": [
      "KIRO_SESSION_ID"
    ]
  },
  "newChatStep": {
    "text": "type /chat new, then <entry>",
    "inHost": {
      "env": [
        "TERM_PROGRAM=kiro",
        "VSCODE_IPC_HOOK",
        "VSCODE_PID"
      ],
      "text": "open a new chat, pick the aidlc agent, then type <entry>"
    }
  },
  "kiroLayout": "kas",
  "rulesFolder": "steering"
});
});

test("Kiro IDE keeps its invocation and option choices", () => {
  expect(KIRO_IDE_TOKENS).toEqual({ ["SKILL_INVOKE"]: null, ["OPTION_LETTERS"]: "A-E" });
});

test("Kiro IDE places its authored conductor, helpers, memory reference and gitignore", () => {
  expect(KIRO_IDE_AUTHORED_PLACEMENTS).toEqual([
  {
    "source": "steering/aidlc-active-memory.md",
    "destination": ".kiro/steering/aidlc-active-memory.md"
  },
  {
    "source": "hooks/aidlc-kiro-adapter.ts",
    "destination": ".kiro/hooks/aidlc-kiro-adapter.ts"
  },
  {
    "source": "hooks/aidlc-kiro-tool-names.ts",
    "destination": ".kiro/hooks/aidlc-kiro-tool-names.ts"
  },
  {
    "source": "dot-gitignore",
    "destination": ".gitignore"
  }
]);
});
