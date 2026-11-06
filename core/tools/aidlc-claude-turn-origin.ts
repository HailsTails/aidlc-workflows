// Claude records a prompt's origin after its hook returns. Capture keeps the
// original target; settlement records a confirmed host fact before touching any
// derived reply. Cleanup can then retry without restoring human eligibility.
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { appendAuditEntryAtPathUnlocked } from "./aidlc-audit.ts";
import {
  auditBlockField, auditFilePath, claudeTranscriptOrigin,
  isReadOnlyEngineProbe, personsWordsText, readRegularFileNoFollowOrThrow, recordFileTargetOrThrow, refuseEngineObserverWrite,
  removeRecordFileNoFollow, resolveWorkflowSelection, transactActiveDirective,
  withAuditLock, withdrawLegacyPlanReplyWords, withdrawProtectedReplyWords, writeRecordFileNoFollow,
} from "./aidlc-lib.ts";
import { forgetMessage, isMessageId, readMessage } from "./aidlc-message-store.ts";
import { CLAUDE_TURNS_PENDING_DIR } from "./aidlc-claude-turn-pending.ts";
import { auditShardBlocks } from "./aidlc-record-core.ts";
import {
  hostTurnFactIds, hostTurnFactRel, hostTurnFactPersisted, inspectHostTurnEvidence, observeHostTurnFact,
  validCapturedTurnTarget, type CapturedTurnTarget, type HostTurnFact,
} from "./aidlc-turn-origin-evidence.ts";

export interface PendingClaudeTurn {
  message: string;
  transcript: string;
  promptId: string;
  onRecord?: true;
  /** Timestamp returned by the original audit append owner, not inferred later. */
  turnAt?: string;
  /** Captured at receipt, never reconstructed from a later chat selection. */
  target?: CapturedTurnTarget;
}
const PENDING_MAX = 200;
const PENDING_MAX_BYTES = 256 * 1024;
const CHAT_FILE = /^[A-Za-z0-9._-]{1,128}$/;
const posix = (path: string): string => path.replaceAll("\\", "/");

function pendingRel(projectDir: string, session: string): string {
  return relative(projectDir, join(projectDir, CLAUDE_TURNS_PENDING_DIR, `${session}.json`));
}
function isPending(value: unknown): value is PendingClaudeTurn {
  const entry = value as Partial<PendingClaudeTurn> | null;
  return entry !== null && typeof entry === "object" && typeof entry.message === "string" &&
    isMessageId(entry.message) && typeof entry.transcript === "string" && entry.transcript.endsWith(".jsonl") &&
    typeof entry.promptId === "string" && entry.promptId.length > 0 &&
    (entry.onRecord === undefined || entry.onRecord === true) &&
    (entry.turnAt === undefined || (typeof entry.turnAt === "string" && Number.isFinite(Date.parse(entry.turnAt)))) &&
    (entry.target === undefined || validCapturedTurnTarget(entry.target));
}
function readPending(projectDir: string, session: string): PendingClaudeTurn[] {
  try {
    const raw: unknown = JSON.parse(readRegularFileNoFollowOrThrow(
      join(projectDir, pendingRel(projectDir, session)), "pending turns", PENDING_MAX_BYTES,
    ).toString("utf-8"));
    return Array.isArray(raw) ? raw.filter(isPending) : [];
  } catch { return []; }
}
function writePending(projectDir: string, session: string, entries: readonly PendingClaudeTurn[]): void {
  if (entries.length === 0) removeRecordFileNoFollow(projectDir, pendingRel(projectDir, session));
  else writeRecordFileNoFollow(projectDir, pendingRel(projectDir, session), `${JSON.stringify(entries.slice(-PENDING_MAX))}\n`);
}
export function claudeTurnKey(transcriptPath: unknown, promptId: unknown): { transcript: string; promptId: string } | null {
  if (typeof transcriptPath !== "string" || !transcriptPath.endsWith(".jsonl")) return null;
  if (typeof promptId !== "string" || !promptId.trim()) return null;
  return { transcript: transcriptPath, promptId: promptId.trim() };
}
/** Caller holds the shared audit lock, as for the message and provisional turn. */
export function noteClaudeTurnPending(projectDir: string, session: string, entry: PendingClaudeTurn): void {
  if (!CHAT_FILE.test(session)) return;
  const selection = resolveWorkflowSelection(projectDir, { bind: false });
  const target = entry.target ?? {
    space: selection.space, intent: selection.intent,
    ...(entry.onRecord ? { shard: posix(relative(projectDir, auditFilePath(projectDir))) } : {}),
  };
  writePending(projectDir, session, [...readPending(projectDir, session).filter((kept) => kept.message !== entry.message),
    { ...entry, target }]);
}

type Verdict = { kind: "host"; reason: string } | { kind: "person" } | { kind: "pending" };
// Only exact recorded origin settles the prompt. Missing or mismatched rows
// remain unknown; the canonical reader bounds transcript I/O.
function verdictOf(entry: PendingClaudeTurn, prompt: string): Verdict {
  const origin = claudeTranscriptOrigin(entry.transcript, entry.promptId, prompt);
  if (origin?.kind === "host") return { kind: "host", reason: origin.reason };
  return origin?.kind === "person" ? { kind: "person" } : { kind: "pending" };
}

function persistHostFact(projectDir: string, fact: HostTurnFact): void {
  refuseEngineObserverWrite("persistHostFact");
  writeRecordFileNoFollow(projectDir, hostTurnFactRel(fact.message), `${JSON.stringify(fact)}\n`);
  hostTurnFactPersisted(projectDir, fact.message);
}

// The same fact moves after cleanup; discovery costs only the outstanding
// backlog, not every historical host wake. A crash after compact but before
// rename leaves an active compact fact whose only remaining work is this move.
function archiveHostFact(projectDir: string, id: string): void {
  refuseEngineObserverWrite("archiveHostFact");
  const source = recordFileTargetOrThrow(projectDir, hostTurnFactRel(id));
  const target = recordFileTargetOrThrow(projectDir, hostTurnFactRel(id, true));
  mkdirSync(dirname(target), { recursive: true });
  recordFileTargetOrThrow(projectDir, hostTurnFactRel(id, true));
  renameSync(source, target);
}

function observedFact(entry: PendingClaudeTurn, session: string, reason: string): HostTurnFact {
  return { version: 1, message: entry.message, kind: "host", reason: reason.slice(0, 200),
    observedAt: new Date().toISOString(),
    ...(entry.onRecord && entry.turnAt && entry.target?.shard
      ? { turn: { session, at: entry.turnAt, shard: entry.target.shard } } : {}),
    cleanup: { session, target: entry.target ?? null, onRecord: entry.onRecord === true } };
}

/** Resolve pending observations, then retry independently durable cleanup facts. */
export function settleClaudeTurns(projectDir: string): void {
  let chats: string[] = [];
  try {
    chats = readdirSync(join(projectDir, CLAUDE_TURNS_PENDING_DIR))
      .filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).filter((name) => CHAT_FILE.test(name));
  } catch { /* Confirmed-host cleanup is independent of this queue. */ }
  // Facts observed by this command remain negative even if taking the write
  // lock fails. Read-only observers classify without creating any project bytes.
  for (const chat of chats) {
    for (const entry of readPending(projectDir, chat)) {
      try {
        if (inspectHostTurnEvidence(projectDir, entry.message).kind !== "none") continue;
        const message = readMessage(projectDir, entry.message);
        if (message === null) continue;
        const verdict = verdictOf(entry, personsWordsText(message.text));
        if (verdict.kind === "host") observeHostTurnFact(projectDir, observedFact(entry, chat, verdict.reason));
      } catch { /* A failed read cannot establish an origin. */ }
    }
  }
  if (isReadOnlyEngineProbe()) return;
  for (const chat of chats) {
    try {
        withAuditLock(projectDir, () => {
          const left: PendingClaudeTurn[] = [];
          for (const entry of readPending(projectDir, chat)) {
            const known = inspectHostTurnEvidence(projectDir, entry.message);
            if (known.kind === "unavailable") { left.push(entry); continue; }
            if (known.kind === "host") {
              // Also retries a persistence failure remembered by this process.
              persistHostFact(projectDir, known.fact);
              continue;
            }
            const message = readMessage(projectDir, entry.message);
            if (message === null) continue;
            const prompt = personsWordsText(message.text);
            const verdict = verdictOf(entry, prompt);
            if (verdict.kind === "person") continue;
            if (verdict.kind === "pending") { left.push(entry); continue; }
            const fact = observedFact(entry, chat, verdict.reason);
            // Record negative knowledge before any write or cleanup can fail.
            observeHostTurnFact(projectDir, fact);
            persistHostFact(projectDir, fact);
          }
          writePending(projectDir, chat, left);
        });
    } catch { /* The key stays retryable; any observed host is already ineligible. */ }
  }
  let ids: string[];
  try { ids = hostTurnFactIds(projectDir); } catch { return; }
  for (const id of ids) {
    try {
      const evidence = inspectHostTurnEvidence(projectDir, id);
      if (evidence.kind !== "host") continue;
      withAuditLock(projectDir, () => {
        const latest = inspectHostTurnEvidence(projectDir, id);
        if (latest.kind !== "host") return;
        if (latest.fact.cleanup !== undefined) {
          if (!withdrawHostMaterial(projectDir, latest.fact)) return;
          const { cleanup: _cleanup, ...fact } = latest.fact;
          // One atomic rewrite compacts retry detail while preserving the fact.
          persistHostFact(projectDir, fact);
        }
        archiveHostFact(projectDir, id);
      });
    } catch { /* A durable host fact remains effective until cleanup succeeds. */ }
  }
}

function withdrawHostMaterial(projectDir: string, fact: HostTurnFact): boolean {
  const cleanup = fact.cleanup!;
  const target = cleanup.target;
  const steps: Array<() => void> = [
    () => {
      if (!cleanup.onRecord) return;
      // An old pending key with no captured shard cannot authorize a write to
      // whatever work its chat happens to select now. The host fact still holds.
      if (!target?.shard || !fact.turn) throw new Error("Original turn witness is unavailable");
      const shard = recordFileTargetOrThrow(projectDir, target.shard);
      const blocks = auditShardBlocks(readRegularFileNoFollowOrThrow(shard, "original turn shard").toString("utf-8"));
      if (blocks.some((block) => auditBlockField(block, "Event") === "HOST_TURN" && auditBlockField(block, "Message Id") === fact.message &&
        auditBlockField(block, "Session") === fact.turn!.session && auditBlockField(block, "Turn Timestamp") === fact.turn!.at)) return;
      if (!blocks.some((block) => auditBlockField(block, "Event") === "HUMAN_TURN" && auditBlockField(block, "Message Id") === fact.message &&
        auditBlockField(block, "Session") === fact.turn!.session && auditBlockField(block, "Timestamp") === fact.turn!.at)) {
        throw new Error("Original turn is unavailable");
      }
      appendAuditEntryAtPathUnlocked("HOST_TURN", {
        Session: fact.turn.session, Origin: "host", Reason: fact.reason, Source: "record", "Message Id": fact.message, "Turn Timestamp": fact.turn.at,
      }, projectDir, shard);
    },
    () => withdrawProtectedReplyWords(projectDir, { messageId: fact.message, strict: true }),
    () => withdrawLegacyPlanReplyWords(projectDir, { session: cleanup.session, messageId: fact.message }),
    () => {
      if (target === null) throw new Error("Original plan-reply target is unavailable");
      (require("./aidlc-plan-approval-ask.ts") as {
        withdrawPlanApprovalReplies(projectDir: string, which: { messageId: string; intent?: string; space?: string; strict?: true }): void;
      }).withdrawPlanApprovalReplies(projectDir, { messageId: fact.message, intent: target.intent ?? "", space: target.space, strict: true });
    },
    () => withdrawGuardRecoveryReply(projectDir, fact),
    () => forgetMessage(projectDir, fact.message),
  ];
  let all = true;
  for (const step of steps) {
    try { step(); } catch { all = false; }
  }
  return all;
}

function withdrawGuardRecoveryReply(projectDir: string, fact: HostTurnFact): void {
  const target = fact.cleanup?.target;
  if (!target) throw new Error("Original guard-reply target is unavailable");
  transactActiveDirective(projectDir, (marker) => {
    const response = marker?.guard_recovery_response;
    const matches = response?.message_id === fact.message;
    return !matches || marker === null ? { marker, result: undefined, preserve: true }
      : { marker: { ...marker, revision: (marker.revision ?? 0) + 1, delivery: "issued", guard_recovery_response: undefined }, result: undefined };
  }, target.intent ?? "", target.space, true);
}
