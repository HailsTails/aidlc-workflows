import type { AuditEvent, AuditFact } from "../domain/audit.ts";
import type { GuardRefusal, GuardSwitch } from "../domain/guard.ts";
import { enforce, type GuardContext, type GuardVerdict } from "../domain/guard-standing.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";
import { auditTrail, type AuditScene } from "./audit-trail.ts";
import type { AuditLog, GuardEnvironment } from "./ports.ts";

export type RaisedStop = {
  readonly refusal: GuardRefusal;
  readonly record: WorkflowRecord;
  readonly scene: AuditScene;
  readonly after: AuditEvent | null;
};

export type RaiseStop = (stop: RaisedStop) => Promise<GuardVerdict>;

export type StopDependencies = {
  readonly audit: AuditLog;
  readonly environment: GuardEnvironment;
};

const spentSwitches = (events: readonly AuditEvent[]): readonly GuardSwitch[] =>
  events.flatMap(({ fact }) =>
    fact.kind === "guard-stood-aside" && fact.because.kind !== "policy" ? [fact.because.change] : [],
  );

const contextFor = async (
  dependencies: StopDependencies,
  record: WorkflowRecord,
): Promise<GuardContext> => {
  const [lock, machineSwitches, events] = await Promise.all([
    dependencies.environment.lock(),
    dependencies.environment.machineSwitches(),
    dependencies.audit.since({ intent: record.id, after: null }),
  ]);
  return {
    policy: record.settings.guardPolicy,
    lock,
    switches: record.guardSwitches,
    machineSwitches,
    spent: spentSwitches(events),
  };
};

const verdictFact = (verdict: GuardVerdict): AuditFact =>
  verdict.kind === "holds"
    ? { kind: "guard-refused", refusal: verdict.refusal }
    : { kind: "guard-stood-aside", guard: verdict.guard, because: verdict.because };

export const stopRaiser = (dependencies: StopDependencies): RaiseStop => {
  const trail = auditTrail(dependencies.audit);
  return async (stop) => {
    const verdict = enforce(stop.refusal, await contextFor(dependencies, stop.record));
    const fact = verdictFact(verdict);
    await (stop.after === null ? trail.record(stop.scene, fact) : trail.recordAfter(stop.after, [fact]));
    return verdict;
  };
};

export const heldRefusal = (verdict: GuardVerdict, raised: GuardRefusal): GuardRefusal =>
  verdict.kind === "holds" ? verdict.refusal : raised;
