type TextSink = { readonly write: (text: string) => unknown };

type TerminalHost = {
  readonly argv: readonly string[];
  readonly stdout: TextSink;
  readonly stderr: TextSink;
  readonly stdin: AsyncIterable<unknown> | Iterable<unknown>;
  readonly setExitCode: (exitCode: number) => void;
};

type Terminal = {
  readonly commandArguments: () => readonly string[];
  readonly writeOutput: (text: string) => void;
  readonly writeError: (text: string) => void;
  readonly readInput: () => Promise<string>;
  readonly finish: (exitCode: number) => void;
};

const RUNTIME_AND_SCRIPT_ARGUMENTS = 2;

const createTerminal = (host: TerminalHost): Terminal => ({
  commandArguments: () => host.argv.slice(RUNTIME_AND_SCRIPT_ARGUMENTS),
  writeOutput: (text) => {
    host.stdout.write(text);
  },
  writeError: (text) => {
    host.stderr.write(text);
  },
  readInput: async () => (await Array.fromAsync(host.stdin, String)).join(""),
  finish: (exitCode) => {
    host.setExitCode(exitCode);
  },
});

const createProcessTerminal = (): Terminal =>
  createTerminal({
    argv: process.argv,
    stdout: process.stdout,
    stderr: process.stderr,
    stdin: process.stdin,
    setExitCode: (exitCode) => {
      process.exitCode = exitCode;
    },
  });

export { createProcessTerminal, createTerminal, type Terminal, type TerminalHost };
