import type { CommandRunner } from "../application/ports.ts";
import { temporaryEnvironment } from "./run-temp.ts";

export const processRunner = (root: string, temp: string): CommandRunner => {
  const environmentOf = (command: { readonly env?: Readonly<Record<string, string>> }) => ({
    ...(command.env ?? process.env),
    ...temporaryEnvironment(temp),
  });
  return {
    capture: (command) => {
      const result = Bun.spawnSync([...command.argv], {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: environmentOf(command),
      });
      return {
        exitCode: result.exitCode,
        output: `${result.stdout.toString()}${result.stderr.toString()}`,
      };
    },
    attach: (command) =>
      Bun.spawnSync([...command.argv], {
        cwd: root,
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
        env: environmentOf(command),
      }).exitCode,
  };
};
