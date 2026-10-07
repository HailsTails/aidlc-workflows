// Operator-steer interrupt class for gate sessions.
//
// A lane running a teammate or subagent seat has its parent turn SUSPENDED. A
// message sent during that window is echoed into the operator's view at once —
// so both sides read it as delivered — but it reaches the model only when the
// parent turn resumes, and on resume the parent follows the plan it already
// had. The steer is never acknowledged, and the failure is silent on both
// sides. The anti-stall rails compound it: they rank a mid-scope steer below
// finishing the current gate step, exactly as designed.
//
// Boundary seam (measured live 2026-09-05, not read off documentation — the
// evidence is at the record's evidence/hook-event-probe-live-2026-09-05.jsonl):
// SubagentStop fires on the SUBAGENT's termination, and the parent's own resume
// is the PostToolUse that follows it 3.2s later carrying tool_name "Agent".
// Both events deliver the PARENT's `transcript_path`, so both can read the
// queue. Registering on PostToolUse alone would surface a steer only at the next
// tool boundary; registering on SubagentStop as well is what closes the
// seat-return window the operator actually loses messages in.
//
// Why an advisory and not a block: the rails are correct and this must not
// weaken them. A steer is surfaced for ACKNOWLEDGEMENT within one tool call,
// after which the lane resumes its gate work. Nothing here tells a lane to stop.
//
// Exit-code contract: ALWAYS exit 0. A steer that cannot be read is silent,
// never a stall — an unreadable transcript must not cost the operator a turn.

import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import {
  acknowledgementDirective,
  alreadySurfaced,
  pendingSteerIn,
  recordSurfaced,
  type SteerLedger,
} from "./rin-operator-steer-detect.ts";
import {
  advisoryContextPayload,
  invokedProjectDirectory,
} from "./shared-core-bare.ts";

const readStdin = (): Promise<string> =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

// The harness delivers snake_case wire fields. They are named as string
// constants and parsed once here, then mapped to the internal shape, so the
// wire spelling stays at this seam and no snake_case identifier escapes it.
const HOOK_EVENT_NAME_FIELD = "hook_event_name";
const TRANSCRIPT_PATH_FIELD = "transcript_path";

const hookInvocationSchema = z
  .object({
    [HOOK_EVENT_NAME_FIELD]: z.string().optional(),
    [TRANSCRIPT_PATH_FIELD]: z.string().optional(),
    cwd: z.string().optional(),
  })
  .transform((wire) => ({
    hookEventName: wire[HOOK_EVENT_NAME_FIELD],
    transcriptPath: wire[TRANSCRIPT_PATH_FIELD],
    cwd: wire.cwd,
  }));

type HookInvocation = z.infer<typeof hookInvocationSchema>;

const LEDGER_NAME = ".rin-operator-steer-surfaced";
const COMMON_DIR_POINTER = "commondir";

// The ledger is per-clone runtime, so it resolves to the PRIMARY checkout via
// the git common dir — the same resolution the review scribe uses. A worktree's
// `.git` is a FILE pointing at `<primary>/.git/worktrees/<name>`, which carries
// a `commondir` pointer back to the primary's git dir. Resolving here rather
// than at the invoking cwd means a session that changes worktrees mid-run still
// reads one ledger, so a steer surfaced in one worktree is not re-surfaced in
// the next.
const primaryGitDirectoryFrom = (
  startDirectory: string,
): string | undefined => {
  const gitPath = join(startDirectory, ".git");
  if (!existsSync(gitPath)) {
    const parent = dirname(startDirectory);
    return parent === startDirectory
      ? undefined
      : primaryGitDirectoryFrom(parent);
  }
  if (statSync(gitPath).isDirectory()) return gitPath;

  const pointer = readFileSync(gitPath, "utf8").match(/^gitdir:\s*(.+?)\s*$/m);
  const pointerTarget = pointer?.[1];
  if (pointerTarget === undefined) return undefined;
  const worktreeGitDir = isAbsolute(pointerTarget)
    ? pointerTarget
    : resolve(startDirectory, pointerTarget);
  const commonDirPointer = join(worktreeGitDir, COMMON_DIR_POINTER);
  if (!existsSync(commonDirPointer)) return worktreeGitDir;
  const commonDir = readFileSync(commonDirPointer, "utf8").trim();
  if (commonDir === "") return worktreeGitDir;
  return isAbsolute(commonDir) ? commonDir : resolve(worktreeGitDir, commonDir);
};

// The default factory for the SteerLedger port. An unreachable ledger reads as
// empty and swallows its write: the cost is at worst a repeat surfacing, where
// failing loud would trade the operator's message for a stalled turn — the
// exact defect this hook exists to prevent. Appending rather than rewriting
// keeps the write O(1) on a file that every tool call touches.
const unreachableLedgerFingerprints: readonly string[] = [];

const fileBackedLedgerAt = (ledgerPath: string): SteerLedger => ({
  readFingerprints: (): readonly string[] => {
    try {
      return existsSync(ledgerPath)
        ? readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean)
        : unreachableLedgerFingerprints;
    } catch {
      return unreachableLedgerFingerprints;
    }
  },
  appendFingerprint: (fingerprint: string): void => {
    try {
      appendFileSync(ledgerPath, `${fingerprint}\n`, "utf8");
    } catch (unreachableLedger) {
      void unreachableLedger;
    }
  },
});

const ledgerForInvocation = (invocation: HookInvocation): SteerLedger => {
  const startDirectory = invocation.cwd ?? invokedProjectDirectory();
  const gitDirectory = primaryGitDirectoryFrom(startDirectory);
  return fileBackedLedgerAt(join(gitDirectory ?? startDirectory, LEDGER_NAME));
};

const main = async (): Promise<void> => {
  if (process.stdin.isTTY) process.exit(0);
  const raw = await readStdin();
  if (raw.trim() === "") process.exit(0);

  let invocation: HookInvocation;
  try {
    invocation = hookInvocationSchema.parse(JSON.parse(raw));
  } catch {
    process.exit(0);
  }

  const transcriptPath = invocation.transcriptPath;
  if (transcriptPath === undefined || !existsSync(transcriptPath)) {
    process.exit(0);
  }

  let transcript: string;
  try {
    transcript = readFileSync(transcriptPath, "utf8");
  } catch {
    process.exit(0);
  }

  const pending = pendingSteerIn({ transcript });
  if (pending.state === "none") process.exit(0);

  const ledger = ledgerForInvocation(invocation);
  if (alreadySurfaced({ ledger, steer: pending.steer })) process.exit(0);
  recordSurfaced({ ledger, steer: pending.steer });

  process.stdout.write(
    `${advisoryContextPayload({
      hookEventName: invocation.hookEventName ?? "PostToolUse",
      additionalContext: acknowledgementDirective({ steer: pending.steer }),
    })}\n`,
  );
  process.exit(0);
};

await main();
