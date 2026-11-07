import { fail, succeed, type Result } from "../domain/result.ts";
import type { ProcessExit, ProcessRunner } from "./process-runner.ts";

const EXIT_SUCCESS = 0;

type CommandInvocation = { readonly command: string; readonly commandArguments: readonly string[] };

type CommandFailed = {
  readonly kind: "command-failed";
  readonly command: string;
  readonly detail: string;
};

type CommandRunner = (invocation: CommandInvocation) => Promise<Result<string, CommandFailed>>;

const exitDetail = ({ standardError, exitCode }: ProcessExit): string => {
  const reported = standardError.trim();
  return reported === "" ? `exited with code ${String(exitCode)}` : reported;
};

const createCommandRunner =
  (runProcess: ProcessRunner): CommandRunner =>
  async ({ command, commandArguments }) => {
    const commandLine = [command, ...commandArguments].join(" ");
    const ran = await runProcess({ command, commandArguments, environment: {}, standardInput: undefined });
    if (ran.kind === "failure") {
      return fail({ kind: "command-failed", command: commandLine, detail: ran.reason.detail });
    }
    if (ran.outcome.exitCode !== EXIT_SUCCESS) {
      return fail({ kind: "command-failed", command: commandLine, detail: exitDetail(ran.outcome) });
    }
    return succeed(ran.outcome.standardOutput);
  };

export { createCommandRunner, type CommandFailed, type CommandInvocation, type CommandRunner };
