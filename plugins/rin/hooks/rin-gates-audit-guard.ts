// PreToolUse path guard for the engine's native audit trail.
//
// Matcher: Write|Edit|MultiEdit|Bash. Denies any attempt to create, edit, or
// shell-write a file under an intent record's audit dir
// (aidlc/spaces/<space>/intents/<record>/audit/). Those shards are
// ENGINE-WRITABLE-ONLY: the only legitimate writers are the AIDLC CLI tools
// (aidlc-state.ts / aidlc-orchestrate.ts, via aidlc-audit.ts appendAuditEntry),
// which write via node fs from inside their own process — the Bash command names
// the orchestrate tool, never the audit path, so this guard never sees the
// legitimate write (exactly as the retired receipt guard never saw the scribe's
// fs writes).
//
// Why this guard exists: under repo-as-sole-SoR the engine's stage transition
// (report --result approved -> Current Stage + the audit event) IS the gate
// proof — there is no separate DB receipt to project. The audit shard therefore
// carries the anti-forgery weight the receipts carried before, and needs the
// same hook-write-only protection: a model must not be able to hand-forge a
// STAGE_COMPLETED / GATE_APPROVED entry to fake a gate transition. This guard is
// the direct successor to rin-gates-receipt-guard.ts (retired with the receipt
// scribe when the DB stopped being a second source of truth).
//
// Deny = exit 2 + stderr (Claude Code's PreToolUse deny convention). Allow =
// exit 0. Anything not touching an intents/<record>/audit/ path is allowed.

const AUDIT_SEGMENT = /[\\/]intents[\\/][^\\/]+[\\/]audit[\\/]/i;

type HookInput = {
  readonly tool_name?: string;
  readonly tool_input?: {
    readonly file_path?: string;
    readonly command?: string;
  };
};

const readStdin = (): Promise<string> =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const deny = (reason: string): never => {
  process.stderr.write(reason);
  process.exit(2);
};

// A Bash command is a WRITE into an audit dir only when it both names an
// intents/<record>/audit/ path and uses a mutating construct (redirect, tee,
// cp/mv/install, truncate, rm, sed -i, dd). A read (cat/ls/grep) that merely
// names the path is allowed — the dir is hook-WRITABLE-only, not
// hook-readable-only. File-descriptor-only redirects (`2>/dev/null`, `2>&1`,
// `>/dev/null`) are discarded before the mutating test: they silence streams,
// write no file, and would otherwise deny every read-only command that combined
// an audit `ls`/`cat` with stderr silencing.
const AUDIT_PATH_IN_COMMAND = /[\\/]intents[\\/][^\\/\s]+[\\/]audit[\\/]/i;
const FD_ONLY_REDIRECT = /\d*>>?\s*(?:\/dev\/null|nul)\b|\d*>&\d+/gi;
const MUTATING_SHELL =
  /(>>?|\btee\b|\bcp\b|\bmv\b|\binstall\b|\btruncate\b|\brm\b|\bsed\b\s+[^\n|;&]*-i|\bdd\b)/i;

// NO DELETION ALLOWANCE HERE — and the reason is worth keeping, because the
// obvious analogy to the verdict guard is WRONG (decorrelated security review
// of PR #389, 2026-07-30).
//
// The tempting move is to mirror PR #384's verdict-guard allowance (ruling
// 019fa8ba: "write-prevention over-covers when the real invariant is 'only
// tool T may produce this'") and permit deleting a shard that carries no
// GATE_APPROVED / STAGE_COMPLETED event, on the theory that removing no proof
// forges none. That theory is FALSE for the audit shard, on two independent
// grounds:
//
// 1. THE LEDGER IS READ FOR REFUSALS, NOT ONLY APPROVALS. aidlc-lib.ts's
//    GATE_RESOLUTION_EVENTS is {GATE_APPROVED, GATE_REJECTED,
//    QUESTION_ANSWERED}, and humanActedSinceGate compares the last resolution
//    against the last HUMAN_TURN. A GATE_REJECTED raises lastResolution, which
//    is exactly what refuses a stale approve. Deleting a rejection-only shard
//    LOWERS lastResolution and flips that predicate from refuse to allow — the
//    lane ends up strictly BETTER off, which is the fabrication class this
//    guard exists to stop. Erasing a refusal is as good as forging an approval.
//    This is the same reasoning the verdict guard already applies to the
//    scribe's .rin-gates-review-captures accumulation (a standing refusal must
//    not be wipeable — retiring one requires that SAME lens to report again at
//    the same head, which is a review, not an erasure); the audit shard holds
//    that same class of poison.
//
// 2. THE CHECK CANNOT BE BOUND TO THE ACT. A PreToolUse hook reads the file,
//    then the rm runs later in another process, and it cannot hold the append
//    lock across that gap. The pipeline is explicitly concurrent, so a
//    routine `report --result approved` landing between the read and the
//    unlink deletes proof the guard just certified absent.
//
// Whatever the strandage tasks (019faaed, 019faaf0) need, a racy hook-side
// content check is not it: shard removal belongs behind a sanctioned engine
// subcommand that does the check and the unlink under the writer's own lock.
// With no deletion allowance there is no operand-level decision to make here:
// every mutating command naming an audit path is denied outright, so the
// quote-normalisation and metacharacter veto the verdict guard needs have no
// counterpart in this file. They would be unreachable code pretending to be a
// control.
//
// A read that merely names a shard is allowed (the dir is writable-only, not
// readable-only), so a command carrying no mutating construct passes.
const touchesAudit = (input: HookInput): boolean => {
  const filePath = input.tool_input?.file_path ?? "";
  if (AUDIT_SEGMENT.test(filePath)) return true;
  const command = input.tool_input?.command ?? "";
  if (!AUDIT_PATH_IN_COMMAND.test(command)) return false;
  return MUTATING_SHELL.test(command.replace(FD_ONLY_REDIRECT, " "));
};

const main = async (): Promise<void> => {
  const raw = await readStdin();
  if (raw.trim() === "") process.exit(0);

  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    process.exit(0);
  }

  if (!touchesAudit(input)) process.exit(0);

  deny(
    "Blocked: an intent record's audit/ shard is engine-writable-only. An audit " +
      "entry (STAGE_COMPLETED / GATE_APPROVED and every other event) is written " +
      "by the AIDLC CLI tools (aidlc-state.ts / aidlc-orchestrate.ts report) via " +
      "appendAuditEntry — never by hand. To record a stage transition, make the " +
      "real `aidlc-orchestrate.ts report --result approved` call; the engine " +
      "writes the audit event on success. A hand-written audit entry would be a " +
      "fabricated gate proof and is refused.\n",
  );
};

main().catch(() => process.exit(0));

export {};
