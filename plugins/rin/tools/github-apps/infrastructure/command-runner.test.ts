import { assert, describe, expect, it } from "vitest";
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
});
