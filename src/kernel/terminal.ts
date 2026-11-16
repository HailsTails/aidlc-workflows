import type { Terminal } from "./terminal-port.ts";

type TextStream = { readonly write: (text: string) => unknown };

type TerminalStreams = { readonly stdout: TextStream; readonly stderr: TextStream };

type CreateProcessTerminalArgs = { readonly streams?: TerminalStreams };

export const createProcessTerminal = (
  { streams = { stdout: process.stdout, stderr: process.stderr } }: CreateProcessTerminalArgs = {},
): Terminal => ({
  write: (text) => {
    streams.stdout.write(text);
  },
  writeError: (text) => {
    streams.stderr.write(text);
  },
});