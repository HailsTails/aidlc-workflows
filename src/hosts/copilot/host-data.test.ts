import { expect, test } from "bun:test";
import { host } from "../../kernel/fixtures/values.fixture.ts";
import { copilotHostIdentity, COPILOT_HOST_DATA, COPILOT_TOKENS, COPILOT_AUTHORED_PLACEMENTS } from "./host-data.ts";

test("Copilot declares one runtime surface for CLI and VS Code", () => {
  expect(COPILOT_HOST_DATA.productName).toBe("GitHub Copilot");
  expect(COPILOT_HOST_DATA.configNextStep).toBe("start Copilot CLI or VS Code agent mode, then run `/aidlc --doctor`");
  expect(COPILOT_HOST_DATA.rulesFolder).toBeNull();
  expect(COPILOT_HOST_DATA.hostShell).toEqual({ env: ["COPILOT_CLI"] });
  expect(COPILOT_HOST_DATA.newChatStep).toEqual({ text: "open a new chat, then type <entry>" });
});

test("Copilot keeps runners typed-only and terminal output within the host limit", () => {
  expect(COPILOT_HOST_DATA.runnerFrontmatterAdditions).toEqual(["disable-model-invocation: true"]);
  expect(COPILOT_HOST_DATA.directiveMaxBytes).toBe(19000);
  expect(COPILOT_TOKENS).toEqual({ ["SKILL_INVOKE"]: null, ["OPTION_LETTERS"]: "A-E" });
});

test("Copilot places its adapter, gitignore and VS Code settings without taking documents", () => {
  expect(COPILOT_AUTHORED_PLACEMENTS).toEqual([
    { source: "hooks/aidlc-copilot-adapter.ts", destination: ".aidlc/hooks/aidlc-copilot-adapter.ts" },
    { source: "dot-gitignore", destination: ".gitignore" },
    { source: "dot-vscode-settings.json", destination: ".vscode/settings.json" },
  ]);
});

test("Copilot owns its checked distribution identity and native directory", () => {
  expect(copilotHostIdentity()).toEqual({ ok: true, value: host({ name: "copilot", directory: ".aidlc" }) });
});

test("Copilot declares the host-specific hook recovery instructions", () => {
  expect(COPILOT_HOST_DATA.hookActivation).toEqual(
    {
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
  }
  );
});
