// Confirmed host origin is a fact, independent of reply cleanup or admission policy.
// No missing observation is promoted to person origin. Historical audit parsers
// stay pure; live readers supply their project when applying these facts.
import { readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { assertNoSymlinkInChainOrThrow, readRegularFileNoFollowOrThrow } from "./aidlc-locks.ts";

export const HOST_TURN_EVIDENCE_DIR = join("aidlc", ".aidlc-sessions", "host-turns");
const ID = /^[0-9a-f]{8}$/;
const SEGMENT = /^[^/\\\0]+$/;
const MAX_BYTES = 16 * 1024;

export interface CapturedTurnTarget {
  space: string;
  intent: string | null;
  /** Project-relative original shard; absent when the hook wrote no turn. */
  shard?: string;
}
export interface HostTurnFact {
  version: 1;
  message: string;
  kind: "host";
  reason: string;
  observedAt: string;
  /** Original hook row identity, retained independently of cleanup. */
  turn?: { session: string; at: string; shard: string };
  /** Cleanup data is compacted only after every physical withdrawal succeeds. */
  cleanup?: {
    session: string;
    target: CapturedTurnTarget | null;
    onRecord: boolean;
  };
}
export type HostTurnEvidence = { kind: "none" } | { kind: "host"; fact: HostTurnFact } | { kind: "unavailable" };

// A failed persistence attempt must not let the command that observed a host
// immediately spend it. Absence is never cached: another process may publish a fact.
const observed = new Map<string, HostTurnFact>();
const key = (projectDir: string, id: string): string => `${realpathSync(projectDir)}\0${id}`;

export function hostTurnFactRel(id: string, settled = false): string {
  if (!ID.test(id)) throw new Error("Invalid host-turn message id");
  return join(HOST_TURN_EVIDENCE_DIR, ...(settled ? ["settled"] : []), `${id}.json`);
}

export function validCapturedTurnTarget(value: unknown): value is CapturedTurnTarget {
  const target = value as Partial<CapturedTurnTarget> | null;
  const segment = (value: unknown): value is string => typeof value === "string" && SEGMENT.test(value) && value !== "." && value !== "..";
  if (target === null || typeof target !== "object" || !segment(target.space) ||
    !(target.intent === null || segment(target.intent))) return false;
  if (target.shard === undefined) return true;
  if (typeof target.shard !== "string") return false;
  const prefix = `aidlc/spaces/${target.space}/intents/${target.intent === null ? "" : `${target.intent}/`}`;
  if (!target.shard.startsWith(prefix)) return false;
  return /^(?:\.aidlc-engine\/)?audit\/[^/\\]+\.md$/.test(target.shard.slice(prefix.length)) &&
    !target.shard.split("/").some((part) => part === "." || part === "..");
}

function validFact(value: unknown, id: string): value is HostTurnFact {
  const fact = value as Partial<HostTurnFact> | null;
  const cleanup = fact?.cleanup;
  return fact !== null && typeof fact === "object" && fact.version === 1 && fact.message === id && fact.kind === "host" &&
    typeof fact.reason === "string" && fact.reason.length > 0 && fact.reason.length <= 200 &&
    typeof fact.observedAt === "string" && Number.isFinite(Date.parse(fact.observedAt)) &&
    (fact.turn === undefined || (typeof fact.turn.session === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(fact.turn.session) &&
      typeof fact.turn.at === "string" && Number.isFinite(Date.parse(fact.turn.at)) &&
      typeof fact.turn.shard === "string" && fact.turn.shard.startsWith("aidlc/") &&
      !fact.turn.shard.split("/").some(part => part === "." || part === ".." || part.includes("\\")))) &&
    (cleanup === undefined || (cleanup !== null && typeof cleanup === "object" &&
      typeof cleanup.session === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(cleanup.session) &&
      typeof cleanup.onRecord === "boolean" && (cleanup.target === null || validCapturedTurnTarget(cleanup.target))));
}

export function observeHostTurnFact(projectDir: string, fact: HostTurnFact): void {
  if (!validFact(fact, fact.message)) throw new Error("Invalid host-turn fact");
  observed.set(key(projectDir, fact.message), fact);
}

export function hostTurnFactPersisted(projectDir: string, id: string): void {
  observed.delete(key(projectDir, id));
}

export function inspectHostTurnEvidence(projectDir: string, id: string): HostTurnEvidence {
  if (!ID.test(id)) return { kind: "none" };
  try {
    const held = observed.get(key(projectDir, id));
    if (held) return { kind: "host", fact: held };
    // Check active before settled: an atomic active -> settled move cannot
    // fall between both absence checks. Neither location expires the fact.
    for (const settled of [false, true]) {
      try {
        const path = assertNoSymlinkInChainOrThrow(realpathSync(projectDir), hostTurnFactRel(id, settled));
        const fact: unknown = JSON.parse(readRegularFileNoFollowOrThrow(path, "host-turn evidence", MAX_BYTES).toString("utf-8"));
        return validFact(fact, id) ? { kind: "host", fact } : { kind: "unavailable" };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return { kind: "unavailable" };
      }
    }
    return { kind: "none" };
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? { kind: "none" } : { kind: "unavailable" };
  }
}

/** A confirmed host, or damaged negative-evidence record, cannot prove a person acted. */
export function messageHasNegativeOriginEvidence(projectDir: string, id: string | null | undefined): boolean {
  return id !== null && id !== undefined && inspectHostTurnEvidence(projectDir, id).kind !== "none";
}

/** A message id alone cannot identify a historical row from another turn or clone. */
export function turnHasNegativeOriginEvidence(projectDir: string, id: string | null, session: string | null, at: string | null): boolean {
  if (id === null) return false;
  const evidence = inspectHostTurnEvidence(projectDir, id);
  if (evidence.kind === "unavailable") return true;
  return evidence.kind === "host" && evidence.fact.turn !== undefined &&
    evidence.fact.turn.session === session && evidence.fact.turn.at === at;
}

export function hostTurnFactIds(projectDir: string): string[] {
  const dir = assertNoSymlinkInChainOrThrow(realpathSync(projectDir), HOST_TURN_EVIDENCE_DIR);
  try {
    return readdirSync(dir).filter((name) => /^[0-9a-f]{8}\.json$/.test(name)).map((name) => name.slice(0, -5));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
