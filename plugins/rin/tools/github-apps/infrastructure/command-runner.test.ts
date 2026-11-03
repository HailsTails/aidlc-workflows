import { assert, describe, expect, it } from "vitest";
import { succeed } from "../domain/result.ts";
import { runCommand } from "./command-runner.ts";

describe("runCommand", () => {
  it("returns what the command printed", async () => {
    const ran = await runCommand({ command: process.execPath, commandArguments: ["--version"] });

    assert(ran.kind === "success");
    expect(ran.outcome).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("reports a command that cannot be run", async () => {
    const ran = await runCommand({
      command: "rin-no-such-command",
      commandArguments: ["status"],
    });

    assert(ran.kind === "failure");
    expect(ran.reason.command).toBe("rin-no-such-command status");
    expect(ran.reason.detail).toContain("ENOENT");
  });

  it("feeds standard input and the given environment to the command", async () => {
    const ran = await runCommand({
      command: process.execPath,
      commandArguments: [
        "-e",
        "process.stdin.on('data', (chunk) => process.stdout.write(process.env.RIN_PROBE + ':' + chunk))",
      ],
      environment: { RIN_PROBE: "probe" },
      standardInput: "body",
    });

    expect(ran).toEqual(succeed("probe:body"));
  });

  it("keeps what a failing command printed before it failed", async () => {
    const ran = await runCommand({
      command: process.execPath,
      commandArguments: ["-e", "process.stdout.write('partial'); process.exit(1)"],
    });

    assert(ran.kind === "failure");
    expect(ran.reason.standardOutput).toBe("partial");
  });
});
