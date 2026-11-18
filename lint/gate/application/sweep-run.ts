import { CHECK_IDS } from "../domain/outcome.ts";
import { budgetOf, relianceNote, relianceOn } from "../domain/sweep.ts";
import type { SweepLedger } from "./ports.ts";
import type { FullRequest } from "./gate-request.ts";
import type { GateReport, GateServices, RunnableRequest } from "./run-gate.ts";

export type SweepTree = {
  readonly head: string;
  readonly foundation: string;
  readonly clean: boolean;
};

export type FoundationSweeps = {
  readonly ledger: SweepLedger;
  readonly tree: () => SweepTree;
  readonly slots: number;
};

const problem = (report: GateReport, message: string): GateReport => ({
  ...report,
  verdict: "red",
  problem: {
    problem: message,
    fix: "Run --full --sweep on the clean current foundation; fix or revert a red foundation.",
  },
});

const emptyReport = (): GateReport => ({
  mode: "full", lane: undefined, base: undefined, verdict: "error", outcomes: [],
  problem: undefined, exitCode: undefined,
});

const complete = (report: GateReport): boolean =>
  report.verdict === "green" &&
  CHECK_IDS.every((id) => report.outcomes.some((outcome) => outcome.id === id)) &&
  ["tests", "goldens"].every((id) =>
    report.outcomes.some((outcome) => outcome.id === id && outcome.status === "green"),
  );

const validate = (tree: SweepTree, request: FullRequest): boolean =>
  tree.clean && tree.head !== "" && tree.head === tree.foundation &&
  request.only === "all" && request.build && !request.record;

const recordRun = async (input: {
  readonly services: GateServices;
  readonly sweeps: FoundationSweeps;
  readonly tree: SweepTree;
  readonly run: () => Promise<GateReport>;
}): Promise<GateReport> => {
  const { services, sweeps, tree, run } = input;
  const started = services.clock.nowMs();
  const entry = { commit: tree.head, result: "pending" as const, finishedAt: 0, durationMs: 0 };
  sweeps.ledger.record(entry);
  let report: GateReport;
  try {
    report = await run();
  } catch (error) {
    sweeps.ledger.record({ ...entry, result: "red", finishedAt: services.clock.nowMs() });
    throw error;
  }
  const after = sweeps.tree();
  const unchanged = after.clean && after.head === tree.head;
  const result = complete(report) && unchanged ? "green" : "red";
  const finishedAt = services.clock.nowMs();
  sweeps.ledger.record({ ...entry, result, finishedAt, durationMs: finishedAt - started });
  const judged = result === "green"
    ? report : problem(report, "foundation sweep is red or incomplete");
  return { ...judged, sweep: { commit: tree.head, state: result }, sweepCached: false };
};

export const runSweep = async (
  services: GateServices,
  request: FullRequest,
  run: () => Promise<GateReport>,
): Promise<GateReport> => {
  const { sweeps } = services;
  if (sweeps === undefined) {
    return problem(emptyReport(), "no foundation sweep store configured");
  }
  const tree = sweeps.tree();
  if (!validate(tree, request)) {
    return problem(emptyReport(),
      "a sweep requires the clean exact foundation and every check/build");
  }
  const entry = sweeps.ledger.find(tree.head);
  if (entry !== undefined) {
    const sweep = relianceOn(tree.head, entry);
    services.progress.note(`recorded foundation sweep: ${relianceNote(sweep)}`);
    const verdict = entry.result === "pending" ? "busy" : entry.result;
    return { ...emptyReport(), verdict, sweep, sweepCached: true };
  }
  return recordRun({ services, sweeps, tree, run });
};

const hasTests = (request: RunnableRequest): boolean =>
  (request.kind === "full" || request.kind === "scope") &&
  (request.only === "all" || request.only.includes("tests") || request.only.includes("goldens"));

const needsReliance = (request: RunnableRequest): boolean =>
  hasTests(request) && !(request.kind === "full" && request.sweep === true);

const withReliance = (
  services: GateServices,
  request: RunnableRequest,
  report: GateReport,
): GateReport => {
  const { sweeps } = services;
  if (sweeps === undefined || report.baseCommit === undefined || !needsReliance(request)) {
    return report;
  }
  const commit = report.baseCommit;
  const baseSweep = relianceOn(commit, sweeps.ledger.find(commit));
  const foundation = sweeps.tree().foundation;
  const currentSweep = relianceOn(foundation, sweeps.ledger.find(foundation));
  const sweep = foundation === commit ? baseSweep : {
    commit, state: "superseded" as const, currentFoundation: foundation,
  };
  services.progress.note(relianceNote(sweep));
  const next = { ...report, sweep };
  const red = baseSweep.state === "red" || currentSweep.state === "red";
  return report.verdict === "green" && red
    ? problem(next, "candidate cannot land: a recorded foundation sweep is red") : next;
};

export const finishGate = (input: {
  readonly services: GateServices;
  readonly request: RunnableRequest;
  readonly report: GateReport;
  readonly started: number;
}): GateReport => {
  const { services, request, report, started } = input;
  const budget = budgetOf({
    sweep: request.kind === "full" && request.sweep === true,
    tookMs: services.clock.nowMs() - started,
  });
  const slowest = [...report.outcomes].sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0];
  const status = budget.over ? "over budget" : "within budget";
  services.progress.note(
    `${status}: ${budget.tookMs} ms / ${budget.limitMs} ms; slowest check ${slowest?.id ?? "none"}`,
  );
  return { ...withReliance(services, request, report), budget };
};