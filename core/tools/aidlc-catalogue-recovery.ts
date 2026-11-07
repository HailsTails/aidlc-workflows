type RecoveryAction = "close-hosts" | "fix-cause";
type CatalogueSnapshot = Readonly<{
  path: string;
  version: string;
  before: string | null;
  after: string | null;
}>;

/** Only Windows lock-like failures justify asking the person to close host applications. */
export function catalogueRefreshRecovery({ platform, errorCode }: {
  readonly platform: string;
  readonly errorCode: unknown;
}): Readonly<{ reason: string | null; action: RecoveryAction }> {
  if (platform === "win32" && (errorCode === "EBUSY" || errorCode === "EPERM" || errorCode === "EACCES")) {
    return { reason: "a program may have a file in it open", action: "close-hosts" };
  }
  const reason = errorCode === "EACCES" || errorCode === "EPERM"
    ? "permission denied"
    : errorCode === "ENOSPC"
    ? "the disk is full"
    : errorCode === "EROFS"
    ? "the disk is read-only"
    : null;
  return { reason, action: "fix-cause" };
}

/** Snapshot evidence determines what can still be said about the failed refresh. */
export function renderCatalogueRefreshWarning({ failure, reason, recoveryAction }: {
  readonly failure: CatalogueSnapshot;
  readonly reason: string;
  readonly recoveryAction: RecoveryAction;
}): string {
  const next = `${recoveryAction === "close-hosts" ? "close Claude Code and Codex" : "fix that"}, then run aidlc use ${failure.version}.`;
  const at = `Warning: the plugin marketplace at ${failure.path}`;
  return failure.before === null || failure.after !== failure.before
    ? `${at} was not refreshed (${reason}) and may be incomplete; ${next}`
    : failure.before === "absent"
    ? `${at} was not created (${reason}); ${next}`
    : `${at} was not refreshed (${reason}), so it still lists the earlier plugins; ${next}`;
}
