import { spawn } from "node:child_process";
import { fail, succeed, type Result } from "../domain/result.ts";

type ProcessInvocation = {
  readonly command: string;
  readonly commandArguments: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly standardInput: string | undefined;
};

type ProcessExit = {
  readonly standardOutput: string;
  readonly standardError: string;
  readonly exitCode: number;
};

type ProcessUnavailable = {
  readonly kind: "process-unavailable";
  readonly command: string;
  readonly detail: string;
};

type ProcessRunner = (
  invocation: ProcessInvocation,
) => Promise<Result<ProcessExit, ProcessUnavailable>>;

const UNKNOWN_EXIT = 1;

const runProcess: ProcessRunner = ({ command, commandArguments, environment, standardInput }) =>
  new Promise((settle) => {
    const child = spawn(command, commandArguments, {
      env: { ...process.env, ...environment },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const standardOutput: string[] = [];
    const standardError: string[] = [];
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => standardOutput.push(chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => standardError.push(chunk));
    child.once("error", (spawnError) =>
      settle(fail({ kind: "process-unavailable", command, detail: spawnError.message })),
    );
    child.once("close", (exitCode) =>
      settle(
        succeed({
          standardOutput: standardOutput.join(""),
          standardError: standardError.join(""),
          exitCode: exitCode ?? UNKNOWN_EXIT,
        }),
      ),
    );
    child.stdin.on("error", () => undefined).end(standardInput ?? "");
  });

export { runProcess, type ProcessExit, type ProcessInvocation, type ProcessRunner };
