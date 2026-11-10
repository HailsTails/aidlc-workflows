import type { HostData, AuthoredPlacement } from "../../projection/domain/host-surface.ts";
import type { HostTokenChoices } from "../../projection/domain/template-token.ts";

export const KIRO_IDE_BINDING_HEADING = "Kiro IDE";

const KIRO_IDE_TRUST_STEP =
  "In Kiro IDE, trust this folder: choose Trust Folder & Continue when Kiro asks whether you " +
  "trust it, or select Manage on the Restricted Mode banner, then Trust. Then run Developer: " +
  "Reload Window from the Command Palette (Ctrl+Shift+P, or Cmd+Shift+P on macOS), and say " +
  "carry on.";
const KIRO_CLI_RESTART =
  "In Kiro CLI, quit Kiro and start `kiro-cli --v3` again in this folder (if Kiro asks whether you " +
  "trust this workspace and you know what is in this folder, choose 'Trust, continue')";
const KIRO_ACP_CLIENT = "If you drive Kiro from an ACP client, the Kiro IDE guide names what that client must send.";
const KIRO_CLI_ACP_STEP = `${KIRO_CLI_RESTART}. ${KIRO_ACP_CLIENT}`;
const KIRO_CLI_ACP_RESTART_STEP = `${KIRO_CLI_RESTART}, then type <entry> to carry on. ${KIRO_ACP_CLIENT}`;
const ANSWER_NOT_RECORDED = "Your answer was not recorded, so you may be asked for it again.";
export const KIRO_IDE_AGENT_SHELL = ["TERM_PROGRAM=kiro", "VSCODE_IPC_HOOK", "VSCODE_PID"];
export const KIRO_IDE_OPEN_REST =
  "; if the Restricted Mode banner shows at the top of the window and you know what is in this folder, " +
  "select Manage on it, then Trust; run `Developer: Reload Window` from the Command Palette (Ctrl+Shift+P, " +
  "or Cmd+Shift+P on macOS), choose the aidlc agent in the chat panel's agent picker, then run `/aidlc --doctor`";
const KIRO_IDE_OPEN = `open this project in Kiro IDE${KIRO_IDE_OPEN_REST}`;
export const KIRO_CLI_START = "start `kiro-cli --v3` in the project";
export const KIRO_CLI_START_REST =
  "; if Kiro asks whether you trust this workspace and you know what is in this folder, choose " +
  '"Trust, continue"; then run `/aidlc --doctor`';
const KIRO_IDE_NOT_RUN_YET_TRUST =
  "choose Trust Folder & Continue when Kiro asks whether you trust it, or select Manage on the " +
  "Restricted Mode banner, then Trust. Then run Developer: Reload Window from the Command Palette " +
  "(Ctrl+Shift+P, or Cmd+Shift+P on macOS), send a message and run doctor again. If AI-DLC was " +
  "installed while Kiro IDE was open, quit Kiro IDE fully and reopen it instead: it keeps the PATH " +
  "it started with, so its hooks cannot find aidlc, and Reload Window does not change that.";
const KIRO_HOOKS_OFF_AGENT =
  "Kiro is not running AI-DLC's hooks in this folder. You cannot change that from inside the chat: " +
  "do not approve, retry, or ask the person to answer again.";

export const KIRO_IDE_HOST_DATA = {
  productName: "Kiro",
  configNextStep: `${KIRO_IDE_OPEN} (in Kiro CLI, ${KIRO_CLI_START} instead${KIRO_CLI_START_REST})`,
  hookActivation: {
    recovery: `${KIRO_IDE_TRUST_STEP} ${KIRO_CLI_ACP_RESTART_STEP}`,
    missedReply:
      "If the person already replied, that reply was not recorded. Do not ask them to answer again now. " +
      "Tell them exactly this, with nothing about why, then only the line below for the tool they are in: " +
      `"${ANSWER_NOT_RECORDED}" ${KIRO_CLI_ACP_STEP}`,
    missedReplyInHost: {
      env: KIRO_IDE_AGENT_SHELL,
      text:
        "If the person already replied, that reply was not recorded. Do not ask them to answer again now. " +
        `Tell them exactly this, with nothing about why: "${ANSWER_NOT_RECORDED} ${KIRO_IDE_TRUST_STEP}"`,
    },
    notRunYet:
      "This is expected before your first chat message here. If you already sent one, trust this " +
      `folder in Kiro IDE: ${KIRO_IDE_NOT_RUN_YET_TRUST} ${KIRO_CLI_RESTART}.`,
    notRunYetCliFirst: {
      env: KIRO_IDE_AGENT_SHELL,
      text:
        "This is expected before your first chat message here. If you already sent one in Kiro CLI, quit " +
        "Kiro and start `kiro-cli --v3` again in this folder (if Kiro asks whether you trust this " +
        "workspace and you know what is in this folder, choose 'Trust, continue'), then send a message " +
        `and run doctor again. If you sent it in Kiro IDE, trust this folder there: ${KIRO_IDE_NOT_RUN_YET_TRUST}`,
    },
    agentStep: `${KIRO_HOOKS_OFF_AGENT} Show the person this line: "${KIRO_CLI_ACP_RESTART_STEP}" Then end your turn.`,
    agentStepInHost: {
      env: KIRO_IDE_AGENT_SHELL,
      text: `${KIRO_HOOKS_OFF_AGENT} Show the person this line: "${KIRO_IDE_TRUST_STEP}" Then end your turn.`,
    },
  },
  hostShell: { env: ["KIRO_SESSION_ID"] },
  newChatStep: {
    text: "type /chat new, then <entry>",
    inHost: { env: KIRO_IDE_AGENT_SHELL, text: "open a new chat, pick the aidlc agent, then type <entry>" },
  },
  kiroLayout: "kas",
  rulesFolder: "steering",
} as const satisfies HostData;

export const KIRO_IDE_TOKENS = {
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
} as const satisfies HostTokenChoices;

export const KIRO_IDE_AUTHORED_PLACEMENTS = [
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
] as const satisfies readonly AuthoredPlacement[];
