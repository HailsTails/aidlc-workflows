import type { HostData, AuthoredPlacement } from "../../projection/domain/host-surface.ts";
import type { HostTokenChoices } from "../../projection/domain/template-token.ts";

export const COPILOT_HOST_DATA = {
  productName: "GitHub Copilot",
  configNextStep: "start Copilot CLI or VS Code agent mode, then run `/aidlc --doctor`",
  rulesFolder: null,
  hookActivation: {
    recovery:
      'In VS Code, turn on Chat: Use Hooks for this folder ("chat.useHooks": true in ' +
      ".vscode/settings.json), then send your next message in the same chat. If your " +
      "organization has switched it off, ask your administrator to turn it on. In the Copilot " +
      "CLI, start it again in this folder and trust the folder when it asks.",
    notRunYet:
      "This is expected before your first Copilot chat in this folder. If you already started " +
      'one, turn on Chat: Use Hooks in VS Code for this folder ("chat.useHooks": true in ' +
      ".vscode/settings.json; if your organization has switched it off, ask your administrator " +
      "to turn it on), or in the Copilot CLI trust this folder when it asks, then send a " +
      "message and run doctor again.",
    notRunInWorkflow:
      "Turn on Chat: Use Hooks in VS Code for this folder (in the Copilot CLI, trust this folder " +
      "when it asks), then carry on.",
    agentStepEdits: ".vscode/settings.json",
    agentStep:
      "Copilot is not running AI-DLC's hooks in this folder. In VS Code: open " +
      "`.vscode/settings.json` by its path (VS Code's file search skips it, so do not search), " +
      'set `"chat.useHooks": true`, keep every other key as it is, and create the file if it ' +
      'does not exist. Then show the person this line: "Fixed. Send your next message here to ' +
      'carry on." If a question was waiting for their answer, show this line instead, then that ' +
      'question: "Fixed. Answer the question below to carry on." If the file already said ' +
      '`true`, show this line instead: "Your organization has switched off Chat: Use Hooks in ' +
      'VS Code. Ask your administrator to turn it on." In the Copilot CLI, change no file and ' +
      'show this line instead: "Quit Copilot, start it again in this folder and trust the folder ' +
      'when it asks, then type <entry> to carry on." In a headless `copilot -p` run, show this ' +
      'line instead: "Start copilot in this folder once, trust the folder when it asks and ' +
      'choose to remember it, then run copilot -p again." Until the person has done their step, ' +
      'do not touch the project\'s files or the workflow, and read any "fix it" as this setting. ' +
      "End your turn right after " +
      "the line: your own next command in this turn would still run without the change.",
  },
  hostShell: { env: ["COPILOT_CLI"] },
  newChatStep: { text: "open a new chat, then type <entry>" },
  runnerFrontmatterAdditions: ["disable-model-invocation: true"],
  directiveMaxBytes: 19000,
} as const satisfies HostData;

export const COPILOT_TOKENS = {
  ["SKILL_INVOKE"]: null,
  ["OPTION_LETTERS"]: "A-E",
} as const satisfies HostTokenChoices;

export const COPILOT_AUTHORED_PLACEMENTS = [
  { source: "hooks/aidlc-copilot-adapter.ts", destination: ".aidlc/hooks/aidlc-copilot-adapter.ts" },
  { source: "dot-gitignore", destination: ".gitignore" },
] as const satisfies readonly AuthoredPlacement[];
