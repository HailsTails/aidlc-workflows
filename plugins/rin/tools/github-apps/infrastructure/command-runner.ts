import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fail, succeed, type Result } from "../domain/result.ts";

const execFileAsync = promisify(execFile);

type CommandInvocation = {
  readonly command: string;
  readonly commandArguments: readonly string[];
  readonly environment?: Readonly<Record<string, string>>;
  readonly standardInput?: string;
};

type CommandFailed = {
  readonly kind: "command-failed";
  readonly command: string;
  readonly detail: string;
  readonly standardOutput: string;
};

type CommandRunner = (invocation: CommandInvocation) => Promise<Result<string, CommandFailed>>;

const failureDetail = (spawnError: unknown): string => {
  if (!(spawnError instanceof Error)) return String(spawnError);
  const standardError =
    "stderr" in spawnError && typeof spawnError.stderr === "string" ? spawnError.stderr.trim() : "";
  return standardError === "" ? spawnError.message : standardError;
};

const failureOutput = (spawnError: unknown): string =>
  spawnError instanceof Error && "stdout" in spawnError && typeof spawnError.stdout === "string"
    ? spawnError.stdout
    : "";

const runCommand: CommandRunner = async ({
  command,
  commandArguments,
  environment,
  standardInput,
}) => {
  try {
    const running = execFileAsync(command, commandArguments, {
      encoding: "utf8",
      env: environment === undefined ? undefined : { ...process.env, ...environment },
    });
    if (standardInput !== undefined) running.child.stdin?.end(standardInput);
    const { stdout } = await running;
    return succeed(stdout);
  } catch (spawnError: unknown) {
    return fail({
      kind: "command-failed",
      command: [command, ...commandArguments].join(" "),
      detail: failureDetail(spawnError),
      standardOutput: failureOutput(spawnError),
    });
  }
};

export { runCommand, type CommandFailed, type CommandInvocation, type CommandRunner };
