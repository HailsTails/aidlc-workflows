import type { GhRun } from "../../application/github-cli-port.ts";
import type { Result } from "../../domain/result.ts";
import type {
  CliCommand,
  CliDependencies,
  CommandOutcome,
  CommandReport,
  LocalCommand,
  PassThroughCommand,
  StandaloneCommand,
} from "./cli-command.ts";
import { describeCliFailure, type CliFailure } from "./cli-failure.ts";
import { parseCommandFlags } from "./command-flags.ts";
import { ghCommand } from "./gh-command.ts";
import { localCommands } from "./local-commands.ts";
import type { Terminal } from "./terminal.ts";

const EXIT_SUCCESS = 0;

const EXIT_FAILURE = 1;

const EXIT_USAGE = 2;

const ARGUMENT_SEPARATOR = "--";

const COMMANDS = {
  gh: ghCommand,
  ...localCommands,
} satisfies Readonly<Record<string, CliCommand>>;

type CommandName = keyof typeof COMMANDS;

const isCommandName = (commandName: string): commandName is CommandName =>
  Object.hasOwn(COMMANDS, commandName);

const USAGE = `Usage: bun <harness-dir>/tools/github-apps/cli-main.ts <${Object.keys(COMMANDS).join("|")}> ...\n`;

type CliInvocation = {
  readonly dependencies: CliDependencies;
  readonly commandArguments: readonly string[];
};

type CommandSelection<Command extends CliCommand> = {
  readonly command: Command;
  readonly commandTokens: readonly string[];
  readonly dependencies: CliDependencies;
};

type Reported = {
  readonly outcome: Result<CommandReport, CliFailure>;
  readonly outputOnFailure: string;
  readonly terminal: Terminal;
};

type PassedThrough = {
  readonly outcome: Result<GhRun, CliFailure>;
  readonly terminal: Terminal;
};

type UnknownCommand = { readonly commandName: string; readonly terminal: Terminal };

const withoutSeparator = (tokens: readonly string[]): readonly string[] =>
  tokens[0] === ARGUMENT_SEPARATOR ? tokens.slice(1) : tokens;

const runFlaggedCommand = async ({
  command,
  commandTokens,
  dependencies,
}: CommandSelection<LocalCommand | StandaloneCommand>): CommandOutcome => {
  const flags = parseCommandFlags({ tokens: commandTokens, repeatableFlags: [] });
  if (flags.kind === "failure") return flags;
  if (command.access === "standalone") return command.execute({ flags: flags.outcome, dependencies });
  const configuration = await dependencies.loadConfiguration();
  if (configuration.kind === "failure") return configuration;
  return command.execute({ flags: flags.outcome, configuration: configuration.outcome, dependencies });
};

const runPassThrough = async ({
  command,
  commandTokens,
  dependencies,
}: CommandSelection<PassThroughCommand>): Promise<Result<GhRun, CliFailure>> => {
  const configuration = await dependencies.loadConfiguration();
  if (configuration.kind === "failure") return configuration;
  return command.execute({
    commandArguments: withoutSeparator(commandTokens),
    configuration: configuration.outcome,
    dependencies,
  });
};

const reportFailure = (terminal: Terminal, failure: CliFailure): number => {
  terminal.writeError(`${describeCliFailure(failure)}\n`);
  return EXIT_FAILURE;
};

const reportOutcome = ({ outcome, outputOnFailure, terminal }: Reported): number => {
  if (outcome.kind === "failure") {
    terminal.writeOutput(outputOnFailure);
    return reportFailure(terminal, outcome.reason);
  }
  terminal.writeOutput(outcome.outcome.standardOutput);
  terminal.writeError(outcome.outcome.standardError);
  return EXIT_SUCCESS;
};

const reportPassThrough = ({ outcome, terminal }: PassedThrough): number => {
  if (outcome.kind === "failure") return reportFailure(terminal, outcome.reason);
  terminal.writeOutput(outcome.outcome.standardOutput);
  terminal.writeError(outcome.outcome.standardError);
  return outcome.outcome.exitCode;
};

const reportUnknownCommand = ({ commandName, terminal }: UnknownCommand): number => {
  terminal.writeError(`${describeCliFailure({ kind: "unknown-command", commandName })}\n${USAGE}`);
  return EXIT_USAGE;
};

const runCli = async ({ dependencies, commandArguments }: CliInvocation): Promise<number> => {
  const { terminal } = dependencies;
  const [commandName = "", ...commandTokens] = commandArguments;
  if (!isCommandName(commandName)) return reportUnknownCommand({ commandName, terminal });
  const command: CliCommand = COMMANDS[commandName];
  if (command.access === "pass-through") {
    const outcome = await runPassThrough({ command, commandTokens, dependencies });
    return reportPassThrough({ outcome, terminal });
  }
  const outcome = await runFlaggedCommand({ command, commandTokens, dependencies });
  return reportOutcome({ outcome, outputOnFailure: command.outputOnFailure, terminal });
};

export { runCli, type CliInvocation };
