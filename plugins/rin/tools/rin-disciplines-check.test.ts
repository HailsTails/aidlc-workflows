import { describe, expect, test, vi } from "vitest";
import { type DisciplinesCheckPorts, disciplinesCheckOutcomeOf, runDisciplinesCheck } from "./rin-disciplines-check.ts";
import type { CommandOutput, SyncCommandInput } from "./rin-gates/review-process-port.ts";
import { pathOperationsFor } from "./rin-harness-path-operations.ts";

const TIMEOUT_MILLISECONDS = 1000;

const PACKAGED_CHECK = "/repo/node_modules/discipline-core/core/check/check-command.js";

const VENDORED_CHECK = "/repo/tools/discipline-core/core/check/check-command.ts";

const PASSING_OUTPUT: CommandOutput = { status: 0, stdout: "verdict: pass\n", stderr: "" };

const portsReturning = ({
  output,
  installedFiles,
}: {
  readonly output: CommandOutput;
  readonly installedFiles: readonly string[];
}): DisciplinesCheckPorts => ({
  runSync: vi.fn<(input: SyncCommandInput) => CommandOutput>().mockReturnValue(output),
  pathOperations: pathOperationsFor({ flavour: "posix" }),
  fileKind: { isFile: (path) => installedFiles.includes(path), isDirectory: () => false },
  timeoutMilliseconds: TIMEOUT_MILLISECONDS,
});

describe("disciplinesCheckOutcomeOf", () => {
  test("exit 0 is a pass", () => {
    expect(
      disciplinesCheckOutcomeOf({ output: { status: 0, stdout: "verdict: pass\n", stderr: "" }, timeoutMilliseconds: TIMEOUT_MILLISECONDS }),
    ).toEqual({ kind: "passed" });
  });

  test("exit 0 without a passing verdict reached no verdict", () => {
    expect(
      disciplinesCheckOutcomeOf({ output: { status: 0, stdout: "", stderr: "" }, timeoutMilliseconds: TIMEOUT_MILLISECONDS }),
    ).toEqual({ kind: "unverified", reason: "exit 0" });
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
  test("runs the installed package's built check-command with its base revision, in that checkout", () => {
    const ports = portsReturning({ output: PASSING_OUTPUT, installedFiles: [PACKAGED_CHECK, VENDORED_CHECK] });
    expect(runDisciplinesCheck({ request: { checkoutRoot: "/repo", baseRevision: "origin/main" }, ports })).toEqual({ kind: "passed" });
    expect(ports.runSync).toHaveBeenCalledWith({
      program: "node",
      args: [PACKAGED_CHECK, "--repo", "/repo", "--base-revision", "origin/main"],
      cwd: "/repo",
      timeoutMilliseconds: TIMEOUT_MILLISECONDS,
    });
  });

  test("a vendored copy alone that passes is unverified, never a pass, and names the move to the package", () => {
    const ports = portsReturning({ output: PASSING_OUTPUT, installedFiles: [VENDORED_CHECK] });
    expect(runDisciplinesCheck({ request: { checkoutRoot: "/repo", baseRevision: undefined }, ports })).toEqual({
      kind: "unverified",
      reason:
        "the vendored copy at /repo/tools/discipline-core passed, but a vendored copy is not a verified install: move it to the discipline-core package as tools/discipline-core/MIGRATING.md says",
    });
    expect(ports.runSync).toHaveBeenCalledWith({
      program: "node",
      args: [VENDORED_CHECK, "--repo", "/repo"],
      cwd: "/repo",
      timeoutMilliseconds: TIMEOUT_MILLISECONDS,
    });
  });

  test("a vendored copy alone that fails keeps its failing report", () => {
    const report = "findings (1)\nCD-15#loops audit a.ts:1:0 for\nverdict: fail\n";
    const ports = portsReturning({ output: { status: 1, stdout: report, stderr: "" }, installedFiles: [VENDORED_CHECK] });
    expect(runDisciplinesCheck({ request: { checkoutRoot: "/repo", baseRevision: undefined }, ports })).toEqual({ kind: "failed", report });
  });

  test("an uninstalled core reaches no verdict and runs nothing", () => {
    const ports = portsReturning({ output: PASSING_OUTPUT, installedFiles: [] });
    expect(runDisciplinesCheck({ request: { checkoutRoot: "/repo", baseRevision: undefined }, ports })).toEqual({
      kind: "unverified",
      reason: `discipline-core is not installed: neither ${PACKAGED_CHECK} nor ${VENDORED_CHECK} exists`,
    });
    expect(ports.runSync).not.toHaveBeenCalled();
  });
});