import type { CheckId, CheckOutcome } from "../domain/outcome.ts";
import type { GateScope } from "./gate-scope.ts";
import type { Clock, Progress } from "./ports.ts";

export type GateCheck = {
  readonly id: CheckId;
  readonly run: (scope: GateScope) => Promise<CheckOutcome>;
};

export const runChecks = async (request: {
  readonly scope: GateScope;
  readonly checks: readonly GateCheck[];
  readonly progress: Progress;
  readonly clock: Clock;
}): Promise<readonly CheckOutcome[]> => {
  const outcomes: CheckOutcome[] = [];
  for (const check of request.checks) {
    request.progress.started(check.id);
    const startedAt = request.clock.nowMs();
    const ran = await check.run(request.scope);
    const outcome = { ...ran, durationMs: request.clock.nowMs() - startedAt };
    request.progress.finished(outcome);
    outcomes.push(outcome);
  }
  return outcomes;
};
