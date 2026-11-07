import { createCliDependencies } from "./composition-root.ts";
import { runCli } from "./interface/cli/run-cli.ts";

const dependencies = createCliDependencies();

dependencies.terminal.finish(
  await runCli({ dependencies, commandArguments: dependencies.terminal.commandArguments() }),
);
