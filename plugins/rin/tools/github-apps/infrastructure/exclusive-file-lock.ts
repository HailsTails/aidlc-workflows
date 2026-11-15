import type { ClockPort } from "../application/clock-port.ts";
import type {
  ExclusiveLockPort,
  LockFailure,
  LockRelease,
} from "../application/exclusive-lock-port.ts";
import type { PausePort } from "../application/pause-port.ts";
import type {
  FileMover,
  FileRemover,
  PrivateFileCreator,
} from "../application/private-file-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed, type Result } from "../domain/result.ts";

const LOCK_LIFETIME_SECONDS = 120;

const LOCK_RETRY_MILLISECONDS = 250;

const LOCK_ATTEMPTS = 600;

const EPOCH_SECONDS_PATTERN = /^\d+$/;

type ExclusiveFileLockDependencies = {
  readonly createPrivateFile: PrivateFileCreator;
  readonly readTextFile: TextFileReader;
  readonly moveFile: FileMover;
  readonly removeFile: FileRemover;
  readonly clock: ClockPort;
  readonly pause: PausePort;
  readonly createClaimName: () => string;
};

type LockAttempt = ExclusiveFileLockDependencies & {
  readonly lockLocation: string;
  readonly attemptsLeft: number;
};

type FoundLock = { readonly lockText: string; readonly nowEpochSeconds: number };

type KnownLock = ExclusiveFileLockDependencies & {
  readonly lockLocation: string;
  readonly lockText: string;
};

type ClaimedLock = KnownLock & { readonly claimLocation: string };

const isBreakable = ({ lockText, nowEpochSeconds }: FoundLock): boolean =>
  !EPOCH_SECONDS_PATTERN.test(lockText) || Number(lockText) <= nowEpochSeconds;

const putBackUnlessKnown = async ({
  readTextFile,
  createPrivateFile,
  lockLocation,
  lockText,
  claimLocation,
}: ClaimedLock): Promise<void> => {
  const claimedText = await readTextFile(claimLocation);
  if (claimedText.kind === "failure" || claimedText.outcome === lockText) return;
  await createPrivateFile({ location: lockLocation, text: claimedText.outcome });
};

const removeKnownLock = async (known: KnownLock): Promise<void> => {
  const { moveFile, removeFile, lockLocation, createClaimName } = known;
  const claimLocation = `${lockLocation}.${createClaimName()}.claimed`;
  const claimed = await moveFile({ from: lockLocation, to: claimLocation });
  if (claimed.kind === "failure") return;
  await putBackUnlessKnown({ ...known, claimLocation });
  await removeFile(claimLocation);
};

const attemptLock = async (attempt: LockAttempt): Promise<Result<LockRelease, LockFailure>> => {
  const { lockLocation, attemptsLeft, clock, createPrivateFile, readTextFile } = attempt;
  if (attemptsLeft === 0) return fail({ kind: "lock-unavailable", lockLocation });
  const nowEpochSeconds = clock.nowEpochSeconds();
  const ownLockText = String(nowEpochSeconds + LOCK_LIFETIME_SECONDS);
  const created = await createPrivateFile({ location: lockLocation, text: ownLockText });
  if (created.kind === "success") {
    return succeed(() => removeKnownLock({ ...attempt, lockText: ownLockText }));
  }
  if (created.reason.kind === "file-unwritable") {
    return fail({ kind: "lock-unwritable", lockLocation, detail: created.reason.detail });
  }
  const nextAttempt = { ...attempt, attemptsLeft: attemptsLeft - 1 };
  const foundText = await readTextFile(lockLocation);
  if (foundText.kind === "failure") return attemptLock(nextAttempt);
  if (isBreakable({ lockText: foundText.outcome, nowEpochSeconds })) {
    await removeKnownLock({ ...attempt, lockText: foundText.outcome });
    return attemptLock(nextAttempt);
  }
  await attempt.pause.pauseMilliseconds(LOCK_RETRY_MILLISECONDS);
  return attemptLock(nextAttempt);
};

const createExclusiveFileLock = (
  dependencies: ExclusiveFileLockDependencies,
): ExclusiveLockPort => ({
  acquire: (lockLocation) =>
    attemptLock({ ...dependencies, lockLocation, attemptsLeft: LOCK_ATTEMPTS }),
});

export { createExclusiveFileLock };
