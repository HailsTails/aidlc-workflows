import type { CheckId, CheckOutcome } from "../domain/outcome.ts";
import type { GateScope } from "./gate-scope.ts";
import type { Progress } from "./ports.ts";

export type GateCheck = {
  readonly id: CheckId;
  readonly run: (scope: GateScope) => Promise<CheckOutcome>;
};

export const runChecks = async (request: {
  readonly scope: GateScope;
  readonly checks: readonly GateCheck[];
  readonly progress: Progress;
}): Promise<readonly CheckOutcome[]> => {
  const outcomes: CheckOutcome[] = [];
  for (const check of request.checks) {
    request.progress.started(check.id);
    const outcome = await check.run(request.scope);
    request.progress.finished(outcome);
    outcomes.push(outcome);
  }
  return outcomes;
};
