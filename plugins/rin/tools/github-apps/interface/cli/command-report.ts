import type { CommandReport } from "./cli-command.ts";

const reportLine = (line: string): CommandReport => ({
  standardOutput: `${line}\n`,
  standardError: "",
});

export { reportLine };
