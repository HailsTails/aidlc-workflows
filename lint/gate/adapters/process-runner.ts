import type { CommandRunner } from "../application/ports.ts";

export const processRunner = (root: string): CommandRunner => ({
  capture: (command) => {
    const result = Bun.spawnSync([...command.argv], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
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
      env: process.env,
    }).exitCode,
});
