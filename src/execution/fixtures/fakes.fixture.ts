import { accept } from "../../kernel/fixtures/accept.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { projectPath, timestamp, type Timestamp } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { HumanTurnHistory, MethodProvider } from "../application/boundary-ports.ts";
import type {
  ArtifactLocations,
  AuditLog,
  Clock,
  GuardEnvironment,
  PlanFingerprints,
  RecordStore,
  Sessions,
} from "../application/ports.ts";
import type { AuditEntry, AuditEvent } from "../domain/audit.ts";
import type { HumanEvidence } from "../domain/gate.ts";
import type { GuardSwitch } from "../domain/guard.ts";
import {
  auditSequence,
  recordVersion,
  spaceName,
  type IntentId,
  type PlanFingerprint,
} from "../domain/identities.ts";
import { orderOf } from "../domain/moment.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";
import { CHAT } from "./workflow-record.fixture.ts";

const SESSION_STARTED = accept(timestamp("2026-11-08T08:00:00Z"));

const DEFAULT_SPACE = accept(spaceName("default"));

export type MemoryRecordStore = RecordStore & {
  readonly stored: () => WorkflowRecord | null;
};

export const memoryRecordStore = (initial: WorkflowRecord | null): MemoryRecordStore => {
  let current = initial;
  return {
    stored: () => current,
    load: (intent) =>
      Promise.resolve(
        current?.id === intent ? accepted(current) : refused({ kind: "record-not-found", intent }),
      ),
    save: ({ record, expected }) => {
      if (current !== null && current.version !== expected) {
        return Promise.resolve(
          refused({
            kind: "record-changed",
            intent: record.id,
            expected,
            found: current.version,
          }),
        );
      }
      current = { ...record, version: accept(recordVersion(expected + 1)) };
      return Promise.resolve(accepted(current));
    },
  };
};

export type MemoryAuditLog = AuditLog & {
  readonly events: () => readonly AuditEvent[];
};

export const memoryAuditLog = (initial: readonly AuditEvent[]): MemoryAuditLog => {
  let events = initial;
  return {
    events: () => events,
    append: (entry: AuditEntry) => {
      const event: AuditEvent = { ...entry, sequence: accept(auditSequence(events.length + 1)) };
      events = [...events, event];
      return Promise.resolve(event);
    },
    since: ({ intent, after }) =>
      Promise.resolve(
        events.filter(
          (event) => event.intent === intent && (after === null || event.sequence > after),
        ),
      ),
  };
};

export const fixedClock = (now: Timestamp): Clock => ({ now: () => now });

export const recordedTurns = (turns: readonly HumanEvidence[]): HumanTurnHistory => ({
  humanTurnsSince: ({ session, from }) =>
    Promise.resolve(
      turns.filter(
        (turn) => turn.session === session && orderOf(turn.observedAt, from) !== "earlier",
      ),
    ),
});

export const installedMethod = (method: Method): MethodProvider => ({
  current: () => Promise.resolve(accepted(method)),
});

export const artifactsUnder = (folder: string): ArtifactLocations => ({
  destinationOf: ({ record, unit, artifact }) =>
    accept(projectPath(`${folder}/${record.slug}/${unit ?? "intent"}/${artifact}.md`)),
});

export const chatOn = (intent: IntentId | null): Sessions => ({
  current: () =>
    Promise.resolve({
      id: CHAT,
      startedAt: SESSION_STARTED,
      binding:
        intent === null
          ? null
          : { space: DEFAULT_SPACE, intent, boundAt: SESSION_STARTED, source: "switch" },
    }),
});

export const machineSwitched = (machineSwitches: readonly GuardSwitch[]): GuardEnvironment => ({
  lock: () => Promise.resolve({ kind: "unlocked" }),
  machineSwitches: () => Promise.resolve(machineSwitches),
});

export const guardsAsRecorded: GuardEnvironment = machineSwitched([]);

export const knownPlan = (fingerprint: PlanFingerprint | null): PlanFingerprints => ({
  current: () => Promise.resolve(fingerprint),
});
