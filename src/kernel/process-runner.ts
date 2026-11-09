import type {
  ProcessArgument,
  ProcessExit,
  ProcessRunner,
} from "./process-runner-port.ts";
import { accepted, refused } from "./result.ts";

export type NativeProcessRequest = {
  readonly command: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly cwd: string;
  readonly input: string;
};

export type NativeProcessExit = {
  readonly exitCode: number | null;
  readonly signalCode: string | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type NodeProcessLib = {
  readonly runtime: string;
  readonly runtimeFolder: string;
  readonly nativePath: (location: URL) => string;
  readonly spawn: (nativeProcessRequest: NativeProcessRequest) => Promise<NativeProcessExit>;
};

export type CreateNodeProcessRunnerArgs = { readonly processLib?: NodeProcessLib };

const UNKNOWN_SIGNAL = "unknown";

const bunProcessLib: NodeProcessLib = {
  runtime: process.execPath,
  runtimeFolder: Bun.fileURLToPath(new URL(".", Bun.pathToFileURL(process.execPath))),
  nativePath: (location) => Bun.fileURLToPath(location),
  spawn: async ({ command, env, cwd, input }) => {
    const child = Bun.spawn({ cmd: [...command], env: { ...env }, cwd,
      stdin: new TextEncoder().encode(input), stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { exitCode: child.exitCode, signalCode: child.signalCode, stdout, stderr };
  },
};

const rendered = (processLib: NodeProcessLib, argument: ProcessArgument): string => {
  if (typeof argument === "string") return argument;
  return argument.kind === "path" ? processLib.nativePath(argument.location) : processLib.runtimeFolder;
};

const exitOf = (native: NativeProcessExit): ProcessExit =>
  native.exitCode === null
    ? { kind: "signalled", signal: native.signalCode ?? UNKNOWN_SIGNAL }
    : { kind: "exited", code: native.exitCode };

export const createNodeProcessRunner = (
  { processLib = bunProcessLib }: CreateNodeProcessRunnerArgs = {},
): ProcessRunner => ({
  runCurrentRuntime: async ({ argv, env, cwd, input }) => {
    try {
      const native = await processLib.spawn({
        command: [processLib.runtime, ...argv.map((argument) => rendered(processLib, argument))],
        env: Object.fromEntries(Object.entries(env)
          .map(([variable, argument]) => [variable, rendered(processLib, argument)])),
        cwd: processLib.nativePath(cwd),
        input,
      });
      return accepted({ exit: exitOf(native), stdout: native.stdout, stderr: native.stderr });
    } catch (thrown) {
      return refused({ kind: "not-started", reason: thrown instanceof Error ? thrown.message : String(thrown) });
    }
  },
});
