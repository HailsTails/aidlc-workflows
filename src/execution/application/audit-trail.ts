import type { Timestamp } from "../../kernel/values.ts";
import type { AuditEvent, AuditFact } from "../domain/audit.ts";
import type { IntentId, SessionId } from "../domain/identities.ts";
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
  readonly recordCaused: (facts: CausedFacts) => Promise<readonly AuditEvent[]>;
};

export const auditTrail = (log: AuditLog): AuditTrail => {
  const record = (scene: AuditScene, fact: AuditFact): Promise<AuditEvent> =>
    log.append({ ...scene, causedBy: null, fact });

  const recordCaused = async (facts: CausedFacts): Promise<readonly AuditEvent[]> => {
    const cause = await record(facts.scene, facts.cause);
    const effects = await facts.effects.reduce<Promise<readonly AuditEvent[]>>(
      async (earlier, fact) => [
        ...(await earlier),
        await log.append({ ...facts.scene, causedBy: cause.sequence, fact }),
      ],
      Promise.resolve([]),
    );
    return [cause, ...effects];
  };

  return { record, recordCaused };
};
