import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { failureOutput } from "../domain/failure-output.ts";
import type { Command, CommandResult, CommandRunner } from "../application/ports.ts";
import { temporaryEnvironment } from "./run-temp.ts";

type Spawned = Awaited<ReturnType<typeof Bun.spawn>>;

const textOf = async (stream: ReadableStream<Uint8Array> | number | undefined): Promise<string> =>
  stream instanceof ReadableStream ? new Response(stream).text() : "";

const settled = async (child: Spawned): Promise<CommandResult> => {
  const [stdout, stderr, exitCode] = await Promise.all([
    textOf(child.stdout),
    textOf(child.stderr),
    child.exited,
  ]);
  return { exitCode, output: `${stdout}${stderr}` };
};

const inOrderWithLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<readonly R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
  return results;
};

const retainFailure = (root: string, command: Command, result: CommandResult): CommandResult => {
  if (result.exitCode === 0) return result;
  const parent = join(root, ".cache", "gate-failures");
  mkdirSync(parent, { recursive: true });
  const path = join(mkdtempSync(join(parent, "failure-")), "output.log");
  const header = `${command.label}: exit ${result.exitCode}\n`;
  writeFileSync(path, header + failureOutput(result.output));
  console.error(`gate · failure evidence · ${path}`);
  return result;
};

export const processRunner = (root: string, temp: string): CommandRunner => {
  const environmentOf = (command: { readonly env?: Readonly<Record<string, string>> }) => ({
    ...(command.env ?? process.env),
    ...temporaryEnvironment(temp),
  });
  const spawnAsync = (command: Command) =>
    Bun.spawn([...command.argv], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: environmentOf(command),
    });
  return {
    capture: (command) => {
      const result = Bun.spawnSync([...command.argv], {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: environmentOf(command),
      });
      return retainFailure(root, command, {
        exitCode: result.exitCode,
        output: `${result.stdout.toString()}${result.stderr.toString()}`,
      });
    },
    captureAll: ({ commands, concurrency }) =>
      inOrderWithLimit(commands, concurrency, async (command) =>
        retainFailure(root, command, await settled(spawnAsync(command)))),
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
