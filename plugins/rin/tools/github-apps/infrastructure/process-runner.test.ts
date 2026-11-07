import { describe, expect, it } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { runProcess } from "./process-runner.ts";

const ECHO_INPUT_AND_PROBE = [
  "let input = '';",
  "process.stdin.setEncoding('utf8').on('data', (chunk) => { input += chunk; });",
  "process.stdin.on('end', () => {",
  "  process.stdout.write(input + '|' + process.env.RIN_PROBE);",
  "  process.stderr.write('warned');",
  "  process.exitCode = 3;",
  "});",
].join("\n");

describe("runProcess", () => {
  it("feeds standard input and the environment to the command and returns what it printed and its exit code", async () => {
    expect(
      await runProcess({
        command: process.execPath,
        commandArguments: ["-e", ECHO_INPUT_AND_PROBE],
        environment: { RIN_PROBE: "probe" },
        standardInput: "hello",
      }),
    ).toEqual(succeed({ standardOutput: "hello|probe", standardError: "warned", exitCode: 3 }));
  });

  it("reports a command that cannot be run", async () => {
    expect(
      await runProcess({
        command: "rin-no-such-command",
        commandArguments: ["status"],
        environment: {},
        standardInput: undefined,
      }),
    ).toEqual(
      fail({
        kind: "process-unavailable",
        command: "rin-no-such-command",
        detail: "spawn rin-no-such-command ENOENT",
      }),
    );
  });
});
