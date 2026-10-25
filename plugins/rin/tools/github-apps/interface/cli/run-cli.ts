import type { IdentityConfiguration } from "../../infrastructure/identity-configuration.ts";
import type { CliCommand, CliDependencies, CommandOutcome } from "./cli-command.ts";
import { describeCliFailure } from "./cli-failure.ts";
import { parseCommandFlags, type CommandFlags } from "./command-flags.ts";
import { conversationCommands } from "./conversation-commands.ts";
import { landingCommands } from "./landing-commands.ts";
import { localCommands } from "./local-commands.ts";
import { pullRequestCommands } from "./pull-request-commands.ts";
import type { Terminal } from "./terminal.ts";

const EXIT_SUCCESS = 0;

const EXIT_FAILURE = 1;

const EXIT_USAGE = 2;

const COMMANDS: Readonly<Record<string, CliCommand>> = {
  ...pullRequestCommands,
  ...conversationCommands,
  ...landingCommands,
  ...localCommands,
};

const USAGE = `Usage: bun <harness-dir>/tools/github-apps/cli-main.ts <${Object.keys(COMMANDS).join("|")}> [--flag value ...]\n`;

type CliInvocation = {
  readonly dependencies: CliDependencies;
  readonly commandArguments: readonly string[];
};

type CommandRun = {
  readonly command: CliCommand;
  readonly flags: CommandFlags;
  readonly configuration: IdentityConfiguration;
  readonly dependencies: CliDependencies;
};

type CommandSelection = {
  readonly command: CliCommand;
  readonly flagTokens: readonly string[];
  readonly dependencies: CliDependencies;
};

type OutcomeReport = {
  readonly command: CliCommand;
  readonly outcome: Awaited<CommandOutcome>;
  readonly terminal: Terminal;
};

type UnknownCommand = { readonly commandName: string; readonly terminal: Terminal };

const executeCommand = async ({
  command,
  flags,
  configuration,
  dependencies,
}: CommandRun): CommandOutcome => {
  if (command.access === "local") return command.execute({ flags, configuration, dependencies });
  const token = await dependencies.tokenMinter.mintInstallationToken({
    role: command.role,
    appSlug: configuration.roles[command.role].appSlug,
    repository: configuration.repository,
  });
  if (token.kind === "failure") return token;
  const repositoryApi = dependencies.connectRepository({
    token: token.outcome,
    repository: configuration.repository,
  });
  return command.execute({ flags, configuration, dependencies, role: command.role, repositoryApi });
};

const runCommand = async ({
  command,
  flags,
  dependencies,
}: Omit<CommandRun, "configuration">): CommandOutcome => {
  const configuration = await dependencies.loadConfiguration();
  if (configuration.kind === "failure") return configuration;
  return executeCommand({ command, flags, configuration: configuration.outcome, dependencies });
};

const runWithFlags = async ({
  command,
  flagTokens,
  dependencies,
}: CommandSelection): CommandOutcome => {
  const flags = parseCommandFlags(flagTokens);
  if (flags.kind === "failure") return flags;
  return runCommand({ command, flags: flags.outcome, dependencies });
};

const reportOutcome = ({ command, outcome, terminal }: OutcomeReport): number => {
  if (outcome.kind === "failure") {
    terminal.writeOutput(command.access === "local" ? command.outputOnFailure : "");
    terminal.writeError(`${describeCliFailure(outcome.reason)}\n`);
    return EXIT_FAILURE;
  }
  terminal.writeOutput(outcome.outcome.standardOutput);
  terminal.writeError(outcome.outcome.standardError);
  return EXIT_SUCCESS;
};

const reportUnknownCommand = ({ commandName, terminal }: UnknownCommand): number => {
  terminal.writeError(`${describeCliFailure({ kind: "unknown-command", commandName })}\n${USAGE}`);
  return EXIT_USAGE;
};

const runCli = async ({ dependencies, commandArguments }: CliInvocation): Promise<number> => {
  const { terminal } = dependencies;
  const [commandName = "", ...flagTokens] = commandArguments;
  const command = COMMANDS[commandName];
  if (command === undefined) return reportUnknownCommand({ commandName, terminal });
  const outcome = await runWithFlags({ command, flagTokens, dependencies });
  return reportOutcome({ command, outcome, terminal });
};

export { runCli, type CliInvocation };
