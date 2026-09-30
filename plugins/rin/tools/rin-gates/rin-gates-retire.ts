import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const failWith = <E>(error: E): Result<never, E> => ({
  outcome: "failed",
  error,
});

const TERMINAL_SCOPE = "rin-retired";

const RETIREMENT_PREFIX = "RETIRED: ";

type RetireRequest = {
  readonly recordDirName: string;
  readonly reason: string;
  readonly dryRun: boolean;
};

type RecordState = {
  readonly scope: string | null;
  readonly currentStage: string | null;
  readonly status: string | null;
  readonly completedStages: readonly string[];
};

type RetireOutcome =
  | {
      readonly kind: "already-retired";
      readonly recordDirName: string;
    }
  | {
      readonly kind: "retired";
      readonly recordDirName: string;
      readonly retiredFromStage: string;
      readonly anchoredOn: string;
      readonly reason: string;
    }
  | {
      readonly kind: "planned";
      readonly recordDirName: string;
      readonly retiredFromStage: string;
      readonly anchoredOn: string;
    };

type RetireFailure =
  | { readonly kind: "missing-argument"; readonly flag: string }
  | { readonly kind: "blank-reason" }
  | { readonly kind: "record-not-found"; readonly recordDirName: string }
  | { readonly kind: "state-unreadable"; readonly detail: string }
  | { readonly kind: "no-current-stage"; readonly recordDirName: string }
  | {
      readonly kind: "intent-select-failed";
      readonly recordDirName: string;
      readonly detail: string;
    }
  | {
      readonly kind: "cursor-mismatch";
      readonly recordDirName: string;
      readonly observed: string | null;
    }
  | {
      readonly kind: "scope-change-failed";
      readonly detail: string;
    }
  | {
      readonly kind: "report-failed";
      readonly recordDirName: string;
      readonly detail: string;
    }
  | {
      readonly kind: "not-terminal-after-report";
      readonly recordDirName: string;
      readonly observed: RecordState;
    };

type RetirePorts = {
  readonly readState: (
    recordDirName: string,
  ) => Result<RecordState | null, string>;
  readonly readActiveIntent: () => Result<string | null, string>;
  readonly selectIntent: (recordDirName: string) => Result<void, string>;
  readonly changeScope: (args: {
    readonly recordDirName: string;
    readonly scope: string;
  }) => Result<void, string>;
  readonly reportFinal: (args: {
    readonly stage: string;
    readonly reason: string;
  }) => Result<void, string>;
};

const isTerminal = (state: RecordState): boolean =>
  state.status === "Completed";

type RetirableStage =
  | {
      readonly disposition: "retirable";
      readonly retiredFromStage: string;
      readonly anchorCandidates: readonly [...string[], string];
    }
  | { readonly disposition: "already-terminal" };

const resolveRetirableStage = (args: {
  readonly recordDirName: string;
  readonly ports: RetirePorts;
}): Result<RetirableStage, RetireFailure> => {
  const before = args.ports.readState(args.recordDirName);
  if (before.outcome === "failed") {
    return failWith({ kind: "state-unreadable", detail: before.error });
  }
  if (before.value === null) {
    return failWith({
      kind: "record-not-found",
      recordDirName: args.recordDirName,
    });
  }
  if (isTerminal(before.value))
    return succeed({ disposition: "already-terminal" });

  const retiredFromStage = before.value.currentStage;
  if (retiredFromStage === null || retiredFromStage === "") {
    return failWith({
      kind: "no-current-stage",
      recordDirName: args.recordDirName,
    });
  }
  const completedNewestFirst = [...before.value.completedStages].reverse();
  return succeed({
    disposition: "retirable",
    retiredFromStage,
    anchorCandidates: [...completedNewestFirst, retiredFromStage],
  });
};

const focusCursorOn = (args: {
  readonly recordDirName: string;
  readonly ports: RetirePorts;
}): Result<void, RetireFailure> => {
  const selected = args.ports.selectIntent(args.recordDirName);
  if (selected.outcome === "failed") {
    return failWith({
      kind: "intent-select-failed",
      recordDirName: args.recordDirName,
      detail: selected.error,
    });
  }
  const cursor = args.ports.readActiveIntent();
  if (cursor.outcome === "failed") {
    return failWith({ kind: "state-unreadable", detail: cursor.error });
  }
  return cursor.value === args.recordDirName
    ? succeed(undefined)
    : failWith({
        kind: "cursor-mismatch",
        recordDirName: args.recordDirName,
        observed: cursor.value,
      });
};

const RETIRED_VOCABULARY_PATTERN =
  /not in the compiled graph|Unknown stage:|not present in the state file/;

const reportOnFirstRecognisedAnchor = (args: {
  readonly recordDirName: string;
  readonly anchorCandidates: readonly string[];
  readonly reason: string;
  readonly ports: RetirePorts;
}): Result<string, RetireFailure> => {
  const attempt = (
    remaining: readonly string[],
    lastRefusal: string,
  ): Result<string, RetireFailure> => {
    const [candidate, ...rest] = remaining;
    if (candidate === undefined) {
      return failWith({
        kind: "report-failed",
        recordDirName: args.recordDirName,
        detail: lastRefusal,
      });
    }
    const reported = args.ports.reportFinal({
      stage: candidate,
      reason: args.reason,
    });
    if (reported.outcome === "ok") return succeed(candidate);
    return RETIRED_VOCABULARY_PATTERN.test(reported.error)
      ? attempt(rest, reported.error)
      : failWith({
          kind: "report-failed",
          recordDirName: args.recordDirName,
          detail: reported.error,
        });
  };
  return attempt(args.anchorCandidates, "no anchor candidate was accepted");
};

const driveToTerminal = (args: {
  readonly recordDirName: string;
  readonly anchorCandidates: readonly string[];
  readonly reason: string;
  readonly ports: RetirePorts;
}): Result<string, RetireFailure> => {
  const { recordDirName, anchorCandidates, reason, ports } = args;

  const scoped = ports.changeScope({
    recordDirName,
    scope: TERMINAL_SCOPE,
  });
  if (scoped.outcome === "failed") {
    return failWith({ kind: "scope-change-failed", detail: scoped.error });
  }

  const anchored = reportOnFirstRecognisedAnchor({
    recordDirName,
    anchorCandidates,
    reason,
    ports,
  });
  if (anchored.outcome === "failed") return anchored;

  const afterApprove = ports.readState(recordDirName);
  if (afterApprove.outcome === "failed") {
    return failWith({ kind: "state-unreadable", detail: afterApprove.error });
  }
  if (afterApprove.value === null || isTerminal(afterApprove.value)) {
    return succeed(anchored.value);
  }

  const completed = ports.reportFinal({ stage: anchored.value, reason });
  return completed.outcome === "failed"
    ? failWith({
        kind: "report-failed",
        recordDirName,
        detail: completed.error,
      })
    : succeed(anchored.value);
};

const confirmTerminal = (args: {
  readonly recordDirName: string;
  readonly ports: RetirePorts;
}): Result<void, RetireFailure> => {
  const after = args.ports.readState(args.recordDirName);
  if (after.outcome === "failed") {
    return failWith({ kind: "state-unreadable", detail: after.error });
  }
  return after.value !== null && isTerminal(after.value)
    ? succeed(undefined)
    : failWith({
        kind: "not-terminal-after-report",
        recordDirName: args.recordDirName,
        observed: after.value ?? {
          scope: null,
          currentStage: null,
          status: null,
          completedStages: [],
        },
      });
};

const retire = (args: {
  readonly request: RetireRequest;
  readonly ports: RetirePorts;
}): Result<RetireOutcome, RetireFailure> => {
  const { request, ports } = args;
  const recordDirName = request.recordDirName;

  const stage = resolveRetirableStage({ recordDirName, ports });
  if (stage.outcome === "failed") return stage;
  if (stage.value.disposition === "already-terminal") {
    return succeed({ kind: "already-retired", recordDirName });
  }

  const { retiredFromStage, anchorCandidates } = stage.value;
  if (request.dryRun) {
    return succeed({
      kind: "planned",
      recordDirName,
      retiredFromStage,
      anchoredOn: anchorCandidates[0],
    });
  }

  const focused = focusCursorOn({ recordDirName, ports });
  if (focused.outcome === "failed") return focused;

  const driven = driveToTerminal({
    recordDirName,
    anchorCandidates,
    reason: request.reason,
    ports,
  });
  if (driven.outcome === "failed") return driven;

  const confirmed = confirmTerminal({ recordDirName, ports });
  if (confirmed.outcome === "failed") return confirmed;

  return succeed({
    kind: "retired",
    recordDirName,
    retiredFromStage,
    anchoredOn: driven.value,
    reason: request.reason,
  });
};

const parseRequest = (
  argv: readonly string[],
): Result<RetireRequest, RetireFailure> => {
  const flagValue = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index === -1 ? null : (argv[index + 1] ?? null);
  };
  const recordDirName = flagValue("--record");
  if (recordDirName === null) {
    return failWith({ kind: "missing-argument", flag: "--record" });
  }
  const reason = flagValue("--reason");
  if (reason === null) {
    return failWith({ kind: "missing-argument", flag: "--reason" });
  }
  if (reason.trim() === "") return failWith({ kind: "blank-reason" });
  return succeed({
    recordDirName,
    reason,
    dryRun: argv.includes("--dry-run"),
  });
};

const renderOutcome = (outcome: RetireOutcome): string => {
  switch (outcome.kind) {
    case "planned":
      return `PLAN  ${outcome.recordDirName} would retire from ${outcome.retiredFromStage}, anchoring finality on completed stage ${outcome.anchoredOn} — dry run, state untouched`;
    case "already-retired":
      return `SKIP  ${outcome.recordDirName} is already terminal (no-op)`;
    case "retired":
      return [
        `RETIRED  ${outcome.recordDirName} (from ${outcome.retiredFromStage}, finality anchored on ${outcome.anchoredOn})`,
        `  reason: ${outcome.reason}`,
        "  Status: Completed — read back from the state file, not assumed.",
        "  The record now drops out of the pipeline projection.",
      ].join("\n");
  }
};

const renderFailure = (failure: RetireFailure): string => {
  switch (failure.kind) {
    case "missing-argument":
      return `${failure.flag} is required`;
    case "blank-reason":
      return "--reason must be non-empty: it is the durable record of why the Slice was retired";
    case "record-not-found":
      return `no record dir named ${failure.recordDirName}`;
    case "state-unreadable":
      return `state file unreadable: ${failure.detail}`;
    case "no-current-stage":
      return `${failure.recordDirName} has no Current Stage to retire from`;
    case "intent-select-failed":
      return [
        `could not make ${failure.recordDirName} the active intent: ${failure.detail}`,
        "Nothing was mutated; the record is untouched.",
      ].join("\n");
    case "cursor-mismatch":
      return [
        `the active-intent cursor is ${failure.observed ?? "(none)"}, not ${failure.recordDirName}.`,
        "report acts on the CURSOR, so continuing would retire the wrong record.",
        "Nothing was mutated; the record is untouched.",
      ].join("\n");
    case "scope-change-failed":
      return [
        `scope-change to ${TERMINAL_SCOPE} failed: ${failure.detail}`,
        "Nothing was mutated; the record is untouched.",
      ].join("\n");
    case "report-failed":
      return [
        `${failure.recordDirName} was moved to ${TERMINAL_SCOPE} but the finality report FAILED: ${failure.detail}`,
        "The record is mid-transaction: terminal scope, non-terminal status.",
        "It runs no stage in this state and is invisible to the gate lanes.",
        `Re-run rin-gates:retire for ${failure.recordDirName} to complete it, or`,
        "scope-change back to rin-gates to return it to the pipeline.",
      ].join("\n");
    case "not-terminal-after-report":
      return [
        `${failure.recordDirName} reported success but did NOT reach a terminal state.`,
        `Read back: status=${failure.observed.status ?? "(none)"} stage=${failure.observed.currentStage ?? "(none)"} scope=${failure.observed.scope ?? "(none)"}.`,
        "Treat the retirement as INCOMPLETE and inspect the record before re-running.",
      ].join("\n");
  }
};

type OutcomeReport = {
  readonly disposition: RetireOutcome["kind"];
  readonly recordDirName: string;
  readonly retiredFromStage: string | null;
  readonly anchoredOn: string | null;
  readonly reason: string | null;
};

const reportOf = (outcome: RetireOutcome): OutcomeReport => {
  switch (outcome.kind) {
    case "planned":
      return {
        disposition: "planned",
        recordDirName: outcome.recordDirName,
        retiredFromStage: outcome.retiredFromStage,
        anchoredOn: outcome.anchoredOn,
        reason: null,
      };
    case "already-retired":
      return {
        disposition: "already-retired",
        recordDirName: outcome.recordDirName,
        retiredFromStage: null,
        anchoredOn: null,
        reason: null,
      };
    case "retired":
      return {
        disposition: "retired",
        recordDirName: outcome.recordDirName,
        retiredFromStage: outcome.retiredFromStage,
        anchoredOn: outcome.anchoredOn,
        reason: outcome.reason,
      };
  }
};

type FailureReport = {
  readonly disposition: "failed";
  readonly failure: RetireFailure["kind"];
  readonly detail: string;
  readonly recordDirName: string | null;
  readonly manualRecoveryRequired: boolean;
};

const failureReportOf = (failure: RetireFailure): FailureReport => ({
  disposition: "failed",
  failure: failure.kind,
  detail: renderFailure(failure),
  recordDirName:
    failure.kind === "report-failed" ||
    failure.kind === "not-terminal-after-report" ||
    failure.kind === "record-not-found" ||
    failure.kind === "no-current-stage" ||
    failure.kind === "intent-select-failed" ||
    failure.kind === "cursor-mismatch"
      ? failure.recordDirName
      : null,
  manualRecoveryRequired:
    failure.kind === "report-failed" ||
    failure.kind === "not-terminal-after-report",
});

const fieldOf = (stateBody: string, field: string): string | null => {
  const match = stateBody.match(
    new RegExp(`^- \\*\\*${field}\\*\\*:[ \\t]*(.*)$`, "m"),
  );
  const raw = match?.[1]?.trim();
  return raw === undefined || raw === "" ? null : raw;
};

const completedStagesOf = (stateBody: string): readonly string[] =>
  [...stateBody.matchAll(/^- \[x\] (\S+)/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

const checkoutRootFrom = (dir: string, fallback: string): string => {
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? fallback : checkoutRootFrom(parent, fallback);
};

const intentsRootFor = (args: {
  readonly workspaceRoot: string;
  readonly space: string;
}): string =>
  join(args.workspaceRoot, "aidlc", "spaces", args.space, "intents");

const readStateAt = (args: {
  readonly intentsRoot: string;
  readonly recordDirName: string;
}): Result<RecordState | null, string> => {
  const path = join(args.intentsRoot, args.recordDirName, "aidlc-state.md");
  if (!existsSync(path)) return succeed(null);
  try {
    const body = readFileSync(path, "utf-8");
    return succeed({
      scope: fieldOf(body, "Scope"),
      currentStage: fieldOf(body, "Current Stage"),
      status: fieldOf(body, "Status"),
      completedStages: completedStagesOf(body),
    });
  } catch (error) {
    return failWith(error instanceof Error ? error.message : String(error));
  }
};

const engineErrorDirective = z.object({
  kind: z.literal("error"),
  message: z.string(),
});

const engineErrorMessageIn = (stdout: string): string | null => {
  const messages = stdout.split("\n").flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return [];
    try {
      const directive = engineErrorDirective.safeParse(JSON.parse(trimmed));
      return directive.success ? [directive.data.message] : [];
    } catch {
      return [];
    }
  });
  return messages[0] ?? null;
};

const spawnEngine = (args: {
  readonly command: string;
  readonly commandArguments: readonly string[];
  readonly workspaceRoot: string;
}): Result<void, string> => {
  const spawned = spawnSync("bun", [args.command, ...args.commandArguments], {
    encoding: "utf-8",
    cwd: args.workspaceRoot,
  });
  if (spawned.status !== 0) {
    return failWith(spawned.stderr ?? spawned.stdout ?? "");
  }
  const refusal = engineErrorMessageIn(spawned.stdout ?? "");
  return refusal === null ? succeed(undefined) : failWith(refusal);
};

const readActiveIntentAt = (
  intentsRoot: string,
): Result<string | null, string> => {
  const path = join(intentsRoot, "active-intent");
  if (!existsSync(path)) return succeed(null);
  try {
    const cursor = readFileSync(path, "utf-8").trim();
    return succeed(cursor === "" ? null : cursor);
  } catch (error) {
    return failWith(error instanceof Error ? error.message : String(error));
  }
};

const filesystemPorts = (args: {
  readonly intentsRoot: string;
  readonly utilityCli: string;
  readonly orchestrateCli: string;
  readonly workspaceRoot: string;
}): RetirePorts => ({
  readState: (recordDirName) =>
    readStateAt({ intentsRoot: args.intentsRoot, recordDirName }),
  readActiveIntent: () => readActiveIntentAt(args.intentsRoot),
  selectIntent: (recordDirName) =>
    spawnEngine({
      command: args.utilityCli,
      commandArguments: [
        "intent",
        recordDirName,
        "--project-dir",
        args.workspaceRoot,
      ],
      workspaceRoot: args.workspaceRoot,
    }),
  changeScope: ({ recordDirName, scope }) =>
    spawnEngine({
      command: args.utilityCli,
      commandArguments: [
        "scope-change",
        "--scope",
        scope,
        "--intent",
        recordDirName,
        "--project-dir",
        args.workspaceRoot,
      ],
      workspaceRoot: args.workspaceRoot,
    }),
  reportFinal: ({ stage, reason }) =>
    spawnEngine({
      command: args.orchestrateCli,
      commandArguments: [
        "report",
        "--stage",
        stage,
        "--result",
        "approved",
        "--reason",
        reason,
        "--user-input",
        `${RETIREMENT_PREFIX}${reason}`,
        "--project-dir",
        args.workspaceRoot,
      ],
      workspaceRoot: args.workspaceRoot,
    }),
});

const run = (argv: readonly string[]): number => {
  const asJson = argv.includes("--json");
  const request = parseRequest(argv);
  if (request.outcome === "failed") {
    if (asJson) {
      process.stdout.write(
        `${JSON.stringify(failureReportOf(request.error), null, 2)}\n`,
      );
    }
    process.stderr.write(`rin-gates-retire: ${renderFailure(request.error)}\n`);
    return 1;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const invokingCheckout = checkoutRootFrom(resolve(here), resolve(here));
  const workspaceRoot =
    process.env.RIN_GATES_WORKSPACE_ROOT ?? invokingCheckout;
  const space = process.env.RIN_GATES_SPACE ?? "default";

  const result = retire({
    request: request.value,
    ports: filesystemPorts({
      intentsRoot: intentsRootFor({ workspaceRoot, space }),
      utilityCli:
        process.env.RIN_GATES_ENGINE_CLI ??
        join(invokingCheckout, ".claude", "tools", "aidlc-utility.ts"),
      orchestrateCli:
        process.env.RIN_GATES_ORCHESTRATE_CLI ??
        join(invokingCheckout, ".claude", "tools", "aidlc-orchestrate.ts"),
      workspaceRoot,
    }),
  });

  if (result.outcome === "failed") {
    if (asJson) {
      process.stdout.write(
        `${JSON.stringify(failureReportOf(result.error), null, 2)}\n`,
      );
    }
    process.stderr.write(`rin-gates-retire: ${renderFailure(result.error)}\n`);
    return 1;
  }
  process.stdout.write(
    asJson
      ? `${JSON.stringify(reportOf(result.value), null, 2)}\n`
      : `${renderOutcome(result.value)}\n`,
  );
  return 0;
};

if (import.meta.main) {
  process.exit(run(process.argv.slice(2)));
}

export type {
  FailureReport,
  OutcomeReport,
  RecordState,
  Result,
  RetireFailure,
  RetireOutcome,
  RetirePorts,
  RetireRequest,
};

export {
  engineErrorMessageIn,
  failureReportOf,
  filesystemPorts,
  parseRequest,
  renderFailure,
  renderOutcome,
  reportOf,
  retire,
  TERMINAL_SCOPE,
};
