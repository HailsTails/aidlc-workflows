import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { createCommandRunner } from "./command-runner.ts";
import type { ProcessRunner } from "./process-runner.ts";

const exited = ({ standardError, exitCode }: { readonly standardError: string; readonly exitCode: number }) =>
  succeed({ standardOutput: "main\n", standardError, exitCode });

describe("createCommandRunner", () => {
  it("runs the command with nothing on standard input and no extra environment", async () => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(exited({ standardError: "", exitCode: 0 }));

    await createCommandRunner(runProcess)({ command: "git", commandArguments: ["branch", "--show-current"] });

    expect(runProcess).toHaveBeenCalledExactlyOnceWith({
      command: "git",
      commandArguments: ["branch", "--show-current"],
      environment: {},
      standardInput: undefined,
    });
  });

  it("returns what a successful command printed", async () => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(exited({ standardError: "", exitCode: 0 }));

    expect(await createCommandRunner(runProcess)({ command: "git", commandArguments: ["status"] })).toEqual(
      succeed("main\n"),
    );
  });

  it.each([
    [{ standardError: "fatal: not a git repository\n", exitCode: 128 }, "fatal: not a git repository"],
    [{ standardError: "", exitCode: 1 }, "exited with code 1"],
  ])("fails a command that exits %j", async (exit, detail) => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(exited(exit));

    expect(await createCommandRunner(runProcess)({ command: "git", commandArguments: ["status"] })).toEqual(
      fail({ kind: "command-failed", command: "git status", detail }),
    );
  });

  it("reports a command that cannot be run", async () => {
    const runProcess = vi
      .fn<ProcessRunner>()
      .mockResolvedValue(fail({ kind: "process-unavailable", command: "git", detail: "spawn git ENOENT" }));

    expect(await createCommandRunner(runProcess)({ command: "git", commandArguments: ["status"] })).toEqual(
      fail({ kind: "command-failed", command: "git status", detail: "spawn git ENOENT" }),
    );
  });
});
