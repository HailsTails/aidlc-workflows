import { describe, expect, test } from "vitest";
import {
  engineErrorMessageIn,
  failureReportOf,
  parseRequest,
  type RecordState,
  type RetirePorts,
  type RetireRequest,
  renderFailure,
  renderOutcome,
  reportOf,
  retire,
  TERMINAL_SCOPE,
} from "./rin-gates-retire";

const RECORD = "260717-gate-flow-cohesion";

const request: RetireRequest = {
  recordDirName: RECORD,
  reason: "premise evaporated; every deliverable landed by other means",
  dryRun: false,
};

const liveState: RecordState = {
  scope: "rin-gates",
  currentStage: "rin-gate-0-reconcile",
  status: "In Progress",
  completedStages: ["workspace-detection", "state-init"],
};

const terminalState: RecordState = {
  scope: TERMINAL_SCOPE,
  currentStage: null,
  status: "Completed",
  completedStages: ["workspace-detection", "state-init"],
};

const portsWith = (overrides: Partial<RetirePorts>): RetirePorts => ({
  readState: () => ({ outcome: "ok", value: liveState }),
  readActiveIntent: () => ({ outcome: "ok", value: RECORD }),
  selectIntent: () => ({ outcome: "ok", value: undefined }),
  changeScope: () => ({ outcome: "ok", value: undefined }),
  reportFinal: () => ({ outcome: "ok", value: undefined }),
  ...overrides,
});

const statesInOrder = (states: readonly (RecordState | null)[]) => {
  let call = 0;
  return () => {
    const state = states[Math.min(call, states.length - 1)] ?? null;
    call += 1;
    return { outcome: "ok" as const, value: state };
  };
};

describe("parseRequest", () => {
  test("reads every supplied flag", () => {
    expect(
      parseRequest(["--record", RECORD, "--reason", "obsolete premise"]),
    ).toEqual({
      outcome: "ok",
      value: {
        recordDirName: RECORD,
        reason: "obsolete premise",
        dryRun: false,
      },
    });
  });

  test("reads the dry-run flag", () => {
    const parsed = parseRequest([
      "--record",
      RECORD,
      "--reason",
      "obsolete premise",
      "--dry-run",
    ]);
    expect(parsed.outcome === "ok" ? parsed.value.dryRun : null).toBe(true);
  });

  test("treats a missing --record as a failure rather than defaulting it", () => {
    expect(parseRequest(["--reason", "obsolete premise"])).toEqual({
      outcome: "failed",
      error: { kind: "missing-argument", flag: "--record" },
    });
  });

  test("rejects a whitespace-only reason so the audit row carries real prose", () => {
    expect(parseRequest(["--record", RECORD, "--reason", "   "])).toEqual({
      outcome: "failed",
      error: { kind: "blank-reason" },
    });
  });
});

describe("retire", () => {
  test("moves the record to the terminal scope and reports finality", () => {
    const scopeCalls: string[] = [];
    const reportCalls: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        readState: statesInOrder([liveState, terminalState]),
        changeScope: ({ scope }) => {
          scopeCalls.push(scope);
          return { outcome: "ok", value: undefined };
        },
        reportFinal: ({ stage }) => {
          reportCalls.push(stage);
          return { outcome: "ok", value: undefined };
        },
      }),
    });

    expect(scopeCalls).toEqual([TERMINAL_SCOPE]);
    expect(reportCalls).toEqual(["state-init"]);
    expect(result).toEqual({
      outcome: "ok",
      value: {
        kind: "retired",
        recordDirName: RECORD,
        retiredFromStage: "rin-gate-0-reconcile",
        anchoredOn: "state-init",
        reason: request.reason,
      },
    });
  });

  test("anchors the finality report on the last completed stage, never the mid-flight stage", () => {
    const reportCalls: string[] = [];
    retire({
      request,
      ports: portsWith({
        readState: statesInOrder([
          {
            ...liveState,
            currentStage: "rin-gate-4-implement",
            completedStages: [
              "rin-gate-2-plan-review",
              "rin-gate-3-interface-lock",
            ],
          },
          terminalState,
        ]),
        reportFinal: ({ stage }) => {
          reportCalls.push(stage);
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(reportCalls).toEqual(["rin-gate-3-interface-lock"]);
  });

  test("walks back to an earlier completed stage when the newest one left the compiled graph", () => {
    const reportCalls: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        readState: statesInOrder([
          {
            ...liveState,
            completedStages: ["state-init", "build-and-test"],
          },
          terminalState,
        ]),
        reportFinal: ({ stage }) => {
          reportCalls.push(stage);
          return stage === "build-and-test"
            ? {
                outcome: "failed",
                error: `Internal: reported stage "build-and-test" is not in the compiled graph — cannot commit its transition.`,
              }
            : { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(reportCalls).toEqual(["build-and-test", "state-init"]);
    expect(result.outcome === "ok" ? result.value : null).toMatchObject({
      kind: "retired",
      anchoredOn: "state-init",
    });
  });

  test("does not walk past a refusal that is not about retired stage vocabulary", () => {
    const reportCalls: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        reportFinal: ({ stage }) => {
          reportCalls.push(stage);
          return { outcome: "failed", error: "guard refused" };
        },
      }),
    });
    expect(reportCalls).toEqual(["state-init"]);
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "report-failed",
        recordDirName: RECORD,
        detail: "guard refused",
      },
    });
  });

  test("falls back to the mid-flight stage itself when no stage ever completed", () => {
    const reportCalls: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        readState: statesInOrder([
          { ...liveState, completedStages: [] },
          terminalState,
        ]),
        reportFinal: ({ stage }) => {
          reportCalls.push(stage);
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(reportCalls).toEqual(["rin-gate-0-reconcile"]);
    expect(result.outcome === "ok" ? result.value : null).toMatchObject({
      kind: "retired",
      anchoredOn: "rin-gate-0-reconcile",
    });
  });

  test("reports twice on a gated stage, where approve alone leaves the workflow live", () => {
    const reasons: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        readState: statesInOrder([liveState, liveState, terminalState]),
        reportFinal: ({ reason }) => {
          reasons.push(reason);
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(reasons).toEqual([request.reason, request.reason]);
    expect(result.outcome).toBe("ok");
  });

  test("reports once when the first report already reached the terminal state", () => {
    const reasons: string[] = [];
    retire({
      request,
      ports: portsWith({
        readState: statesInOrder([liveState, terminalState]),
        reportFinal: ({ reason }) => {
          reasons.push(reason);
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(reasons).toEqual([request.reason]);
  });

  test("is a no-op on an already-terminal record", () => {
    const scopeCalls: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        readState: () => ({ outcome: "ok", value: terminalState }),
        changeScope: ({ scope }) => {
          scopeCalls.push(scope);
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(scopeCalls).toEqual([]);
    expect(result).toEqual({
      outcome: "ok",
      value: { kind: "already-retired", recordDirName: RECORD },
    });
  });

  test("mutates nothing under --dry-run", () => {
    const calls: string[] = [];
    const result = retire({
      request: { ...request, dryRun: true },
      ports: portsWith({
        selectIntent: () => {
          calls.push("select");
          return { outcome: "ok", value: undefined };
        },
        changeScope: () => {
          calls.push("scope");
          return { outcome: "ok", value: undefined };
        },
        reportFinal: () => {
          calls.push("report");
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(calls).toEqual([]);
    expect(result).toEqual({
      outcome: "ok",
      value: {
        kind: "planned",
        recordDirName: RECORD,
        retiredFromStage: "rin-gate-0-reconcile",
        anchoredOn: "state-init",
      },
    });
  });

  test("refuses a record that does not exist", () => {
    expect(
      retire({
        request,
        ports: portsWith({ readState: () => ({ outcome: "ok", value: null }) }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "record-not-found", recordDirName: RECORD },
    });
  });

  test("refuses a record with no Current Stage to retire from", () => {
    expect(
      retire({
        request,
        ports: portsWith({
          readState: () => ({
            outcome: "ok",
            value: { ...liveState, currentStage: null },
          }),
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "no-current-stage", recordDirName: RECORD },
    });
  });

  test("aborts before mutating when the cursor did not move to the target", () => {
    const calls: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        readActiveIntent: () => ({ outcome: "ok", value: "some-other-record" }),
        changeScope: () => {
          calls.push("scope");
          return { outcome: "ok", value: undefined };
        },
        reportFinal: () => {
          calls.push("report");
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(calls).toEqual([]);
    expect(result).toEqual({
      outcome: "failed",
      error: {
        kind: "cursor-mismatch",
        recordDirName: RECORD,
        observed: "some-other-record",
      },
    });
  });

  test("does not report finality when the scope change failed", () => {
    const calls: string[] = [];
    const result = retire({
      request,
      ports: portsWith({
        changeScope: () => ({ outcome: "failed", error: "autonomy guard" }),
        reportFinal: () => {
          calls.push("report");
          return { outcome: "ok", value: undefined };
        },
      }),
    });
    expect(calls).toEqual([]);
    expect(result).toEqual({
      outcome: "failed",
      error: { kind: "scope-change-failed", detail: "autonomy guard" },
    });
  });

  test("surfaces a half-applied transaction when the report fails", () => {
    expect(
      retire({
        request,
        ports: portsWith({
          reportFinal: () => ({ outcome: "failed", error: "guard refused" }),
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "report-failed",
        recordDirName: RECORD,
        detail: "guard refused",
      },
    });
  });

  test("fails when the read-back shows the record never reached a terminal state", () => {
    expect(
      retire({
        request,
        ports: portsWith({
          readState: () => ({ outcome: "ok", value: liveState }),
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "not-terminal-after-report",
        recordDirName: RECORD,
        observed: liveState,
      },
    });
  });
});

describe("reporting", () => {
  test("marks a half-applied transaction as needing manual recovery", () => {
    expect(
      failureReportOf({
        kind: "report-failed",
        recordDirName: RECORD,
        detail: "guard refused",
      }).manualRecoveryRequired,
    ).toBe(true);
  });

  test("does not ask for manual recovery when nothing was mutated", () => {
    expect(
      failureReportOf({ kind: "scope-change-failed", detail: "autonomy guard" })
        .manualRecoveryRequired,
    ).toBe(false);
  });

  test("names the record that needs recovery", () => {
    expect(
      failureReportOf({
        kind: "cursor-mismatch",
        recordDirName: RECORD,
        observed: null,
      }).recordDirName,
    ).toBe(RECORD);
  });

  test("carries the reason into the machine-readable report", () => {
    expect(
      reportOf({
        kind: "retired",
        recordDirName: RECORD,
        retiredFromStage: "rin-gate-0-reconcile",
        anchoredOn: "state-init",
        reason: request.reason,
      }),
    ).toEqual({
      disposition: "retired",
      recordDirName: RECORD,
      retiredFromStage: "rin-gate-0-reconcile",
      anchoredOn: "state-init",
      reason: request.reason,
    });
  });

  test("renders the retirement with the reason it recorded", () => {
    expect(
      renderOutcome({
        kind: "retired",
        recordDirName: RECORD,
        retiredFromStage: "rin-gate-0-reconcile",
        anchoredOn: "state-init",
        reason: "premise evaporated",
      }),
    ).toContain("premise evaporated");
  });

  test("tells the operator the record is untouched when nothing was mutated", () => {
    expect(
      renderFailure({ kind: "scope-change-failed", detail: "autonomy guard" }),
    ).toContain("Nothing was mutated");
  });

  test("tells the operator how to recover a half-applied transaction", () => {
    expect(
      renderFailure({
        kind: "report-failed",
        recordDirName: RECORD,
        detail: "guard refused",
      }),
    ).toContain("mid-transaction");
  });
});

describe("engineErrorMessageIn", () => {
  test("surfaces the message of an error directive the engine emitted on exit 0", () => {
    expect(
      engineErrorMessageIn(
        `${JSON.stringify({ kind: "error", message: "Transition rejected by aidlc-state.ts approve" })}\n`,
      ),
    ).toBe("Transition rejected by aidlc-state.ts approve");
  });

  test("treats a done directive as success", () => {
    expect(
      engineErrorMessageIn(
        `${JSON.stringify({ kind: "done", reason: "Committed complete-workflow" })}\n`,
      ),
    ).toBeNull();
  });

  test("treats plain non-JSON output as success", () => {
    expect(engineErrorMessageIn("Scope is already rin-retired\n")).toBeNull();
  });
});
