import { runGhAsBot } from "../../application/run-gh-as-bot.ts";
import type { PassThroughCommand } from "./cli-command.ts";

const ghCommand: PassThroughCommand = {
  access: "pass-through",
  execute: ({ commandArguments, configuration, dependencies }) =>
    runGhAsBot({
      commandArguments,
      configuration,
      dependencies: {
        ...dependencies,
        readStandardInput: dependencies.terminal.readInput,
      },
    }),
};

export { ghCommand };
