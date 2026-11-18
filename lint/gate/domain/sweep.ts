export type SweepResult = "green" | "red" | "pending";

export type SweepEntry = {
  readonly commit: string;
  readonly result: SweepResult;
  readonly finishedAt: number;
  readonly durationMs: number;
};

export type SweepReliance = {
  readonly commit: string;
  readonly state: SweepResult | "none" | "superseded";
  readonly currentFoundation?: string;
};

export const relianceOn = (commit: string, entry: SweepEntry | undefined): SweepReliance => ({
  commit,
  state: entry === undefined || entry.commit !== commit ? "none" : entry.result,
});

const SHORT_COMMIT = 9;

export const relianceNote = (reliance: SweepReliance): string => {
  const short = reliance.commit.slice(0, SHORT_COMMIT);
  if (reliance.state === "superseded") {
    return `sweep of ${short} is superseded by ${reliance.currentFoundation}; runtime unverified`;
  }
  if (reliance.state === "pending") {
    return `sweep pending for ${short}; runtime unverified`;
  }
  return reliance.state === "none"
    ? `no sweep recorded for ${short}; run gate --full --sweep there`
    : `relies on the ${reliance.state} sweep of ${short}`;
};

export const CANDIDATE_BUDGET_MS = 180_000;

export const SWEEP_BUDGET_MS = 600_000;

export type BudgetReport = {
  readonly limitMs: number;
  readonly tookMs: number;
  readonly over: boolean;
};

type BudgetRequest = { readonly sweep: boolean; readonly tookMs: number };

export const budgetOf = (request: BudgetRequest): BudgetReport => {
  const limitMs = request.sweep ? SWEEP_BUDGET_MS : CANDIDATE_BUDGET_MS;
  return { limitMs, tookMs: request.tookMs, over: request.tookMs > limitMs };
};
