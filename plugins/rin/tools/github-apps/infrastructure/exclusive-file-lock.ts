import type { ClockPort } from "../application/clock-port.ts";
import type {
  ExclusiveLockPort,
  LockRelease,
  LockUnavailable,
} from "../application/exclusive-lock-port.ts";
import type { PausePort } from "../application/pause-port.ts";
import type { FileRemover, PrivateFileCreator } from "../application/private-file-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed, type Result } from "../domain/result.ts";

const LOCK_LIFETIME_SECONDS = 120;

const LOCK_RETRY_MILLISECONDS = 250;

const LOCK_ATTEMPTS = 480;

const EPOCH_SECONDS_PATTERN = /^\d+$/;

type ExclusiveFileLockDependencies = {
  readonly createPrivateFile: PrivateFileCreator;
  readonly readTextFile: TextFileReader;
  readonly removeFile: FileRemover;
  readonly clock: ClockPort;
  readonly pause: PausePort;
};

type LockAttempt = ExclusiveFileLockDependencies & {
  readonly lockLocation: string;
  readonly attemptsLeft: number;
};

type FoundLock = { readonly lockText: string; readonly nowEpochSeconds: number };

const isBreakable = ({ lockText, nowEpochSeconds }: FoundLock): boolean =>
  !EPOCH_SECONDS_PATTERN.test(lockText) || Number(lockText) <= nowEpochSeconds;

const releaseOf =
  ({ removeFile, lockLocation }: LockAttempt): LockRelease =>
  async () => {
    await removeFile(lockLocation);
  };

const attemptLock = async (attempt: LockAttempt): Promise<Result<LockRelease, LockUnavailable>> => {
  const { lockLocation, attemptsLeft, clock, createPrivateFile, readTextFile } = attempt;
  if (attemptsLeft === 0) return fail({ kind: "lock-unavailable", lockLocation });
  const nowEpochSeconds = clock.nowEpochSeconds();
  const created = await createPrivateFile({
    location: lockLocation,
    text: String(nowEpochSeconds + LOCK_LIFETIME_SECONDS),
  });
  if (created.kind === "success") return succeed(releaseOf(attempt));
  if (created.reason.kind === "file-unwritable") {
    return fail({ kind: "lock-unavailable", lockLocation });
  }
  const nextAttempt = { ...attempt, attemptsLeft: attemptsLeft - 1 };
  const lockText = await readTextFile(lockLocation);
  if (lockText.kind === "failure") return attemptLock(nextAttempt);
  if (isBreakable({ lockText: lockText.outcome, nowEpochSeconds })) {
    await attempt.removeFile(lockLocation);
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
