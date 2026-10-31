import { describe, expect, test, vi } from "vitest";
import type { DisciplinesCheckOutcome, DisciplinesCheckRequest } from "../tools/rin-disciplines-check.ts";
import { pathOperationsFor } from "../tools/rin-harness-path-operations.ts";
import {
  type ConstitutionGatePorts,
  checkoutPluginPathOf,
  constitutionEngineFromWire,
  constitutionGateDecisionOf,
  type EngineReading,
  gatedCompletionOf,
  gateRunVerdictOf,
  type WalkerGateOutcome,
} from "./rin-constitution-engine-gate-decision.ts";
import { gatedInvocationFrom } from "./rin-constitution-gate.ts";

const COMPLETION_COMMAND = "aidlc engine orchestrate report --stage rin-gate-4-implement --result completed";

const hookInputOf = ({ command, cwd }: { readonly command: string; readonly cwd?: string }): string =>
  JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: cwd ?? "/repo/src" });

const COMPLETION_INPUT = hookInputOf({ command: COMPLETION_COMMAND });

const FAILING_REPORT = [
  "findings (1)",
  "CD-15#loops audit src/loop.ts:1:0 let total = 0;",
  "forfeited (1)",
  "CD-19#import-boundaries audit file-carve-out src/old.ts",
  "verdict: fail",
  "",
].join("\n");

const gatePorts = ({
  engine,
  walker,
  check,
  checkoutRoot = "/repo",
}: {
  readonly engine: EngineReading;
  readonly walker?: WalkerGateOutcome;
  readonly check?: DisciplinesCheckOutcome;
  readonly checkoutRoot?: string | null;
}): ConstitutionGatePorts => ({
  checkoutRootOf: vi.fn<ConstitutionGatePorts["checkoutRootOf"]>().mockReturnValue(checkoutRoot ?? undefined),
  readEngine: vi.fn<ConstitutionGatePorts["readEngine"]>().mockReturnValue(engine),
  runWalkerGate: vi.fn<ConstitutionGatePorts["runWalkerGate"]>().mockReturnValue(walker ?? { kind: "allowed" }),
  runDisciplinesCheck: vi
    .fn<(request: DisciplinesCheckRequest) => DisciplinesCheckOutcome>()
    .mockReturnValue(check ?? { kind: "passed" }),
  recordGateRun: vi.fn<ConstitutionGatePorts["recordGateRun"]>().mockResolvedValue(undefined),
});

const DISCIPLINE_CORE: EngineReading = {
  kind: "read",
  constitutionEngine: { engine: "discipline-core", baseRevision: "origin/main" },
};

const RIN_WALKER: EngineReading = { kind: "read", constitutionEngine: { engine: "rin-walker" } };

describe("gatedCompletionOf", () => {
  test.each([
    ["a stage completion", COMPLETION_INPUT],
    ["an ordinary command", hookInputOf({ command: "git status" })],
    ["a bypassed completion", hookInputOf({ command: `AIDLC_CONSTITUTION_BYPASS=1 ${COMPLETION_COMMAND}` })],
    ["a non-shell tool", JSON.stringify({ tool_name: "Write", tool_input: { command: COMPLETION_COMMAND } })],
    ["text that is not JSON", "report --result completed"],
  ])("agrees with the rin-walker gate on %s", (_label, hookInput) => {
    expect(gatedCompletionOf({ hookInput }) === undefined).toBe(gatedInvocationFrom({ raw: hookInput }) === null);
  });

  test("carries the command and its working directory", () => {
    expect(gatedCompletionOf({ hookInput: COMPLETION_INPUT })).toEqual({ command: COMPLETION_COMMAND, commandCwd: "/repo/src" });
  });
});

describe("constitutionGateDecisionOf", () => {
  test("an ordinary command is allowed without reading the engine", async () => {
    const ports = gatePorts({ engine: DISCIPLINE_CORE });
    expect(await constitutionGateDecisionOf({ hookInput: hookInputOf({ command: "ls" }), ports })).toEqual({ kind: "allow" });
    expect(ports.readEngine).not.toHaveBeenCalled();
  });

  test("under discipline-core a passing check allows the completion", async () => {
    const ports = gatePorts({ engine: DISCIPLINE_CORE });
    expect(await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports })).toEqual({ kind: "allow" });
    expect(ports.runDisciplinesCheck).toHaveBeenCalledWith({ checkoutRoot: "/repo", baseRevision: "origin/main" });
    expect(ports.runWalkerGate).not.toHaveBeenCalled();
  });

  test("under discipline-core a failing check denies with only the failing sections and their remedies", async () => {
    const ports = gatePorts({ engine: DISCIPLINE_CORE, check: { kind: "failed", report: FAILING_REPORT } });
    expect(await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports })).toEqual({
      kind: "deny",
      reason: [
        "Blocked: stage completion refused. discipline-core fails on this tree:",
        "  findings (1)",
        "    CD-15#loops audit src/loop.ts:1:0 let total = 0;",
        "  forfeited (1)",
        "    CD-19#import-boundaries audit file-carve-out src/old.ts",
        "To fix findings: change the code, or record an exception in discipline-exceptions.json with a five-step whyChain.",
        "To fix forfeited: the carved-out file was touched, so make the whole file comply and delete its carve-out (CD-46).",
        "",
      ].join("\n"),
    });
  });

  test("under discipline-core an unverified check denies", async () => {
    const ports = gatePorts({ engine: DISCIPLINE_CORE, check: { kind: "unverified", reason: "exit 2: load failure" } });
    expect(await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports })).toMatchObject({ kind: "deny" });
  });

  test("under discipline-core the verdict is recorded as gate-run telemetry", async () => {
    const ports = gatePorts({ engine: DISCIPLINE_CORE, check: { kind: "failed", report: FAILING_REPORT } });
    await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports });
    expect(ports.recordGateRun).toHaveBeenCalledWith({
      command: COMPLETION_COMMAND,
      checkoutRoot: "/repo",
      verdict: { pass: false, violationsCount: 1, decayPass: false, decayViolationsCount: 1 },
    });
  });

  test("under rin-walker the walker gate decides, and its denial is passed through", async () => {
    const ports = gatePorts({ engine: RIN_WALKER, walker: { kind: "denied", reason: "Blocked: 3 violations\n" } });
    expect(await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports })).toEqual({
      kind: "deny",
      reason: "Blocked: 3 violations\n",
    });
    expect(ports.runWalkerGate).toHaveBeenCalledWith({ checkoutRoot: "/repo", hookInput: COMPLETION_INPUT });
    expect(ports.runDisciplinesCheck).not.toHaveBeenCalled();
  });

  test("under rin-walker a walker gate that reaches no verdict denies", async () => {
    const ports = gatePorts({ engine: RIN_WALKER, walker: { kind: "unverified", reason: "exited 1" } });
    expect(await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports })).toMatchObject({ kind: "deny" });
  });

  test("an unreadable engine denies", async () => {
    const ports = gatePorts({ engine: { kind: "unavailable", reason: "rin-harness-config.ts does not exist" } });
    expect(await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports })).toMatchObject({ kind: "deny" });
    expect(ports.runWalkerGate).not.toHaveBeenCalled();
  });

  test("a working directory in no checkout denies instead of checking another tree", async () => {
    const ports = gatePorts({ engine: DISCIPLINE_CORE, checkoutRoot: null });
    expect(await constitutionGateDecisionOf({ hookInput: COMPLETION_INPUT, ports })).toMatchObject({ kind: "deny" });
    expect(ports.readEngine).not.toHaveBeenCalled();
  });
});

describe("gateRunVerdictOf", () => {
  test("a pass records no violations", () => {
    expect(gateRunVerdictOf({ outcome: { kind: "passed" } })).toEqual({
      pass: true,
      violationsCount: 0,
      decayPass: true,
      decayViolationsCount: 0,
    });
  });
});

describe("constitutionEngineFromWire", () => {
  test.each([
    ['{"engine":"rin-walker"}', { engine: "rin-walker" }],
    ['{"engine":"discipline-core","baseRevision":"origin/main"}', { engine: "discipline-core", baseRevision: "origin/main" }],
    ['{"engine":"discipline-core"}', { engine: "discipline-core", baseRevision: undefined }],
    ['{"engine":"other"}', undefined],
    ["not json", undefined],
  ])("reads %s", (text, expected) => {
    expect(constitutionEngineFromWire({ text })).toEqual(expected);
  });
});

describe("checkoutPluginPathOf", () => {
  const pathOperations = pathOperationsFor({ flavour: "posix" });

  test("an installed hook resolves the checkout's own harness directory", () => {
    expect(
      checkoutPluginPathOf({
        hookDirectory: "/main/.claude/hooks",
        checkoutRoot: "/worktree",
        pluginPath: ["tools", "rin-harness-config.ts"],
        pathOperations,
      }),
    ).toBe("/worktree/.claude/tools/rin-harness-config.ts");
  });

  test("a source-layout hook resolves the checkout's own plugin source", () => {
    expect(
      checkoutPluginPathOf({
        hookDirectory: "/main/plugins/rin/hooks",
        checkoutRoot: "/worktree",
        pluginPath: ["hooks", "rin-constitution-gate.ts"],
        pathOperations,
      }),
    ).toBe("/worktree/plugins/rin/hooks/rin-constitution-gate.ts");
  });
});
