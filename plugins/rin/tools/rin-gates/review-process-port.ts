import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

type SyncCommandInput = {
  readonly program: string;
  readonly args: readonly string[];
  readonly cwd?: string;
};
type CommandInput = {
  readonly program: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly environment?: Readonly<Record<string, string>>;
  readonly input?: string;
};
type CommandOutput = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};
type ReviewProcessPort = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly arguments: readonly string[];
  readonly inputIsTerminal: boolean;
  readonly readInput: () => Promise<string>;
  readonly diagnose: (text: string) => void;
  readonly publish: (text: string) => void;
  readonly exit: (status: number) => never;
  readonly timestamp: () => string;
  readonly runSync: (input: SyncCommandInput) => CommandOutput;
  readonly run: (input: CommandInput) => Promise<CommandOutput>;
};

const childStoppedReadingInput = (error: Error): boolean =>
  "code" in error && error.code === "EPIPE";

const processOperation = <Value>(operation: () => Value): Value => {
  try { return operation(); }
  catch (error) { throw new Error(error instanceof Error ? error.message : String(error)); }
};

const defaultReviewProcessPort = (): ReviewProcessPort => ({
  environment: { ...process.env },
  arguments: [...process.argv],
  inputIsTerminal: process.stdin.isTTY === true,
  diagnose: (text) => { process.stderr.write(text); },
  publish: (text) => { process.stdout.write(text); },
  exit: (status) => process.exit(status),
  timestamp: () => new Date().toISOString(),
  readInput: () => new Promise((resolveInput) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => { text += chunk; });
    process.stdin.on("end", () => resolveInput(text));
  }),
  runSync: ({ program, args, cwd }) => {
    const result = processOperation(() => spawnSync(program, [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }));
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  },
  run: ({ program, args, cwd, environment, input }) => new Promise((resolveOutput, reject) => {
    const child = processOperation(() => spawn(program, [...args], { cwd, env: environment, stdio: ["pipe", "pipe", "pipe"], windowsHide: true }));
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(error.message)));
    child.on("close", (status) => resolveOutput({ status, stdout, stderr }));
    child.stdin.on("error", (error) => {
      if (childStoppedReadingInput(error)) return;
      reject(new Error(error.message));
    });
    child.stdin.end(input ?? "");
  }),
});

export type { CommandInput, CommandOutput, ReviewProcessPort };
export { defaultReviewProcessPort };
