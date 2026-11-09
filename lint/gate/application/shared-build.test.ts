import { describe, expect, test } from "bun:test";
import type { Command, CommandResult } from "./ports.ts";
import { sharedBuild } from "./shared-build.ts";

const COMMAND: Command = { label: "bun scripts/package.ts", argv: ["bun", "scripts/package.ts"] };

const runnerReturning = (result: CommandResult, calls: Command[]) => ({
  capture: (command: Command): CommandResult => {
    calls.push(command);
    return result;
  },
  attach: () => 0,
});

describe("sharedBuild", () => {
  test("builds once however many checks ask for it", () => {
    const calls: Command[] = [];
    const build = sharedBuild(runnerReturning({ exitCode: 0, output: "" }, calls), COMMAND);

    build.ensure();
    build.ensure();
    build.ensure();

    expect(calls).toHaveLength(1);
  });

  test("a failed build is reported to every asker without building again", () => {
    const calls: Command[] = [];
    const build = sharedBuild(runnerReturning({ exitCode: 1, output: "a\nb\nc\nd" }, calls), COMMAND);

    const first = build.ensure();
    const second = build.ensure();

    expect(first?.violation).toBe("failed: b / c / d");
    expect(second).toEqual(first);
    expect(calls).toHaveLength(1);
  });
});
