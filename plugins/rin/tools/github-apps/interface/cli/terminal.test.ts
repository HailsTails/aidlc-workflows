import { describe, expect, it, vi } from "vitest";
import { createTerminal } from "./terminal.ts";

const fakeHost = () => ({
  argv: ["node", "cli-main.ts", "pr", "--title", "Add the basket"],
  stdout: { write: vi.fn() },
  stderr: { write: vi.fn() },
  stdin: ["protocol=https\n", "host=github.com\n"],
  setExitCode: vi.fn(),
});

describe("createTerminal", () => {
  it("hands over the arguments after the runtime and script", () => {
    expect(createTerminal(fakeHost()).commandArguments()).toEqual([
      "pr",
      "--title",
      "Add the basket",
    ]);
  });

  it("writes output and errors to their own streams", () => {
    const host = fakeHost();
    const terminal = createTerminal(host);

    terminal.writeOutput("opened\n");
    terminal.writeError("refused\n");

    expect(host.stdout.write).toHaveBeenCalledExactlyOnceWith("opened\n");
    expect(host.stderr.write).toHaveBeenCalledExactlyOnceWith("refused\n");
  });

  it("reads all of standard input", async () => {
    expect(await createTerminal(fakeHost()).readInput()).toBe("protocol=https\nhost=github.com\n");
  });

  it("finishes with the given exit code", () => {
    const host = fakeHost();

    createTerminal(host).finish(2);

    expect(host.setExitCode).toHaveBeenCalledExactlyOnceWith(2);
  });
});
