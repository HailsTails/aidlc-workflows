import type { Timestamp } from "../../kernel/values.ts";
import type { AuditEvent, AuditFact } from "../domain/audit.ts";
import type { AuditSequence, IntentId, SessionId } from "../domain/identities.ts";
import type { AuditLog } from "./ports.ts";

export type AuditScene = {
  readonly intent: IntentId | null;
  readonly session: SessionId | null;
  readonly at: Timestamp;
};

export type CausedFacts = {
  readonly scene: AuditScene;
  readonly cause: AuditFact;
  readonly effects: readonly AuditFact[];
};

export type AuditTrail = {
  readonly record: (scene: AuditScene, fact: AuditFact) => Promise<AuditEvent>;
  readonly recordAll: (scene: AuditScene, facts: readonly AuditFact[]) => Promise<readonly AuditEvent[]>;
  readonly recordCaused: (facts: CausedFacts) => Promise<readonly AuditEvent[]>;
};

type Appending = {
  readonly scene: AuditScene;
  readonly causedBy: AuditSequence | null;
  readonly facts: readonly AuditFact[];
};

const appendInOrder = (log: AuditLog, appending: Appending): Promise<readonly AuditEvent[]> =>
  appending.facts.reduce<Promise<readonly AuditEvent[]>>(
    async (earlier, fact) => [
      ...(await earlier),
      await log.append({ ...appending.scene, causedBy: appending.causedBy, fact }),
    ],
    Promise.resolve([]),
  );

export const auditTrail = (log: AuditLog): AuditTrail => {
  const record = (scene: AuditScene, fact: AuditFact): Promise<AuditEvent> =>
    log.append({ ...scene, causedBy: null, fact });

  const recordAll = (scene: AuditScene, facts: readonly AuditFact[]): Promise<readonly AuditEvent[]> =>
    appendInOrder(log, { scene, causedBy: null, facts });

  const recordCaused = async (facts: CausedFacts): Promise<readonly AuditEvent[]> => {
    const cause = await record(facts.scene, facts.cause);
    const effects = await appendInOrder(log, {
      scene: facts.scene,
      causedBy: cause.sequence,
      facts: facts.effects,
    });
    return [cause, ...effects];
  };

  return { record, recordAll, recordCaused };
};
