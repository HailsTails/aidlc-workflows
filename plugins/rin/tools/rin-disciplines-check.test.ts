import { describe, expect, test, vi } from "vitest";
import { type DisciplinesCheckPorts, disciplinesCheckOutcomeOf, runDisciplinesCheck } from "./rin-disciplines-check.ts";
import type { CommandOutput, SyncCommandInput } from "./rin-gates/review-process-port.ts";
import { pathOperationsFor } from "./rin-harness-path-operations.ts";

const TIMEOUT_MILLISECONDS = 1000;

const portsReturning = ({
  output,
  installed,
}: {
  readonly output: CommandOutput;
  readonly installed: boolean;
}): DisciplinesCheckPorts => ({
  runSync: vi.fn<(input: SyncCommandInput) => CommandOutput>().mockReturnValue(output),
  pathOperations: pathOperationsFor({ flavour: "posix" }),
  fileKind: { isFile: () => installed, isDirectory: () => false },
  timeoutMilliseconds: TIMEOUT_MILLISECONDS,
});

describe("disciplinesCheckOutcomeOf", () => {
  test("exit 0 is a pass", () => {
    expect(
      disciplinesCheckOutcomeOf({ output: { status: 0, stdout: "verdict: pass\n", stderr: "" }, timeoutMilliseconds: TIMEOUT_MILLISECONDS }),
    ).toEqual({ kind: "passed" });
  });

  test("exit 1 ending in a failing verdict is a failure carrying the report", () => {
    const report = "findings (1)\nCD-15#loops audit a.ts:1:0 for\nverdict: fail\n";
    expect(
      disciplinesCheckOutcomeOf({ output: { status: 1, stdout: report, stderr: "" }, timeoutMilliseconds: TIMEOUT_MILLISECONDS }),
    ).toEqual({ kind: "failed", report });
  });

  test("exit 1 without a failing verdict reached no verdict", () => {
    expect(
      disciplinesCheckOutcomeOf({ output: { status: 1, stdout: "", stderr: "TypeError: boom" }, timeoutMilliseconds: TIMEOUT_MILLISECONDS }),
    ).toEqual({ kind: "unverified", reason: "exit 1: TypeError: boom" });
  });

  test("exit 2 is a load failure, never a verdict", () => {
    expect(
      disciplinesCheckOutcomeOf({
        output: { status: 2, stdout: "load failure: file-malformed disciplines.json", stderr: "" },
        timeoutMilliseconds: TIMEOUT_MILLISECONDS,
      }),
    ).toEqual({ kind: "unverified", reason: "exit 2: load failure: file-malformed disciplines.json" });
  });

  test("no exit status names the timeout", () => {
    expect(
      disciplinesCheckOutcomeOf({ output: { status: null, stdout: "", stderr: "" }, timeoutMilliseconds: TIMEOUT_MILLISECONDS }),
    ).toEqual({ kind: "unverified", reason: "no exit status: node did not start, or did not finish within 1000ms" });
  });
});

describe("runDisciplinesCheck", () => {
  test("runs the checkout's own check-command with its base revision, in that checkout", () => {
    const ports = portsReturning({ output: { status: 0, stdout: "verdict: pass\n", stderr: "" }, installed: true });
    runDisciplinesCheck({ request: { checkoutRoot: "/repo", baseRevision: "origin/main" }, ports });
    expect(ports.runSync).toHaveBeenCalledWith({
      program: "node",
      args: ["/repo/tools/discipline-core/core/check/check-command.ts", "--repo", "/repo", "--base-revision", "origin/main"],
      cwd: "/repo",
      timeoutMilliseconds: TIMEOUT_MILLISECONDS,
    });
  });

  test("an uninstalled core reaches no verdict and runs nothing", () => {
    const ports = portsReturning({ output: { status: 0, stdout: "", stderr: "" }, installed: false });
    expect(runDisciplinesCheck({ request: { checkoutRoot: "/repo", baseRevision: undefined }, ports })).toEqual({
      kind: "unverified",
      reason: "discipline-core is not installed: /repo/tools/discipline-core/core/check/check-command.ts does not exist",
    });
    expect(ports.runSync).not.toHaveBeenCalled();
  });
});
