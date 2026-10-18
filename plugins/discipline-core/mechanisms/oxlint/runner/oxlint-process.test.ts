import { describe, expect, it, vi } from "vitest";
import type { ExecutionPort } from "../../../core/platform-ports/execution-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { createOxlintProcessPort } from "./oxlint-process.ts";

const CLI_ENTRY = absolutePathSchema.parse("C:\\provider\\node_modules\\oxlint\\bin\\oxlint");
const REPOSITORY = absolutePathSchema.parse("C:\\workspace\\consumer project");

describe("createOxlintProcessPort", () => {
  it("prepends the public CLI entry to every ordered argument and preserves an ordinary nonzero exit", () => {
    const run = vi.fn<ExecutionPort["run"]>().mockReturnValue({
      outcome: "ok",
      value: { status: 1, stdout: "{\"diagnostics\":[]}\r\ncomplete output\r\n", stderr: "native diagnostic context\r\n" },
    });
    const port = createOxlintProcessPort({ execution: { run }, cliEntry: CLI_ENTRY });

    expect(port.run({
      arguments: ["--format", "json", "--config", "config with spaces.jsonc", "--", "src/file with spaces.ts"],
      cwd: REPOSITORY,
    })).toEqual({
      outcome: "ok",
      value: { status: 1, stdout: "{\"diagnostics\":[]}\r\ncomplete output\r\n", stderr: "native diagnostic context\r\n" },
    });
    expect(run).toHaveBeenCalledExactlyOnceWith({
      arguments: [CLI_ENTRY, "--format", "json", "--config", "config with spaces.jsonc", "--", "src/file with spaces.ts"],
      cwd: REPOSITORY,
    });
  });

  it("preserves execution failure and its partial output without reporting a successful prefix", () => {
    const run = vi.fn<ExecutionPort["run"]>().mockReturnValue({
      outcome: "failed",
      error: {
        kind: "timed-out",
        detail: "native execution exceeded its bound",
        stdout: "{\"diagnostics\":[",
        stderr: "interrupted output",
        code: "ETIMEDOUT",
        signal: "SIGKILL",
      },
    });
    const port = createOxlintProcessPort({ execution: { run }, cliEntry: CLI_ENTRY });

    expect(port.run({ arguments: [], cwd: REPOSITORY })).toEqual({
      outcome: "failed",
      error: {
        kind: "timed-out",
        detail: "native execution exceeded its bound",
        stdout: "{\"diagnostics\":[",
        stderr: "interrupted output",
        code: "ETIMEDOUT",
        signal: "SIGKILL",
      },
    });
    expect(run).toHaveBeenCalledExactlyOnceWith({ arguments: [CLI_ENTRY], cwd: REPOSITORY });
  });
});
