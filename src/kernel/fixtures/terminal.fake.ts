import type { Terminal } from "../terminal-port.ts";

export type RecordedTerminal = Terminal & {
  readonly output: () => readonly string[];
  readonly errors: () => readonly string[];
};

export const createRecordingTerminal = (): RecordedTerminal => {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    write: (text) => {
      output.push(text);
    },
    writeError: (text) => {
      errors.push(text);
    },
    output: () => output,
    errors: () => errors,
  };
};

export const createRecordingStreams = () => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    streams: {
      stdout: { write: (text: string) => out.push(text) },
      stderr: { write: (text: string) => err.push(text) },
    },
    out,
    err,
  };
};