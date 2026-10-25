import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fail, succeed, type Result } from "../domain/result.ts";

const execFileAsync = promisify(execFile);

type CommandInvocation = { readonly command: string; readonly commandArguments: readonly string[] };

type CommandFailed = {
  readonly kind: "command-failed";
  readonly command: string;
  readonly detail: string;
};

type CommandRunner = (invocation: CommandInvocation) => Promise<Result<string, CommandFailed>>;

const failureDetail = (spawnError: unknown): string => {
  if (!(spawnError instanceof Error)) return String(spawnError);
  const standardError =
    "stderr" in spawnError && typeof spawnError.stderr === "string" ? spawnError.stderr.trim() : "";
  return standardError === "" ? spawnError.message : standardError;
};

const runCommand: CommandRunner = async ({ command, commandArguments }) => {
  try {
    const { stdout } = await execFileAsync(command, commandArguments, { encoding: "utf8" });
    return succeed(stdout);
  } catch (spawnError: unknown) {
    return fail({
      kind: "command-failed",
      command: [command, ...commandArguments].join(" "),
      detail: failureDetail(spawnError),
    });
  }
};

export { runCommand, type CommandFailed, type CommandInvocation, type CommandRunner };
