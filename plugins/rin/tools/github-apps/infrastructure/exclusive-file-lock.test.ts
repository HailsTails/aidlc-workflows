import { assert, describe, expect, it, vi } from "vitest";
import type { ClockPort } from "../application/clock-port.ts";
import type { PausePort } from "../application/pause-port.ts";
import type {
  FileMover,
  FileRemover,
  PrivateFileCreator,
} from "../application/private-file-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed } from "../domain/result.ts";
import { createExclusiveFileLock } from "./exclusive-file-lock.ts";

const lockLocation = "C:/Users/operator/.config/rin-github-apps/author.user-grant.lock";

const claimLocation = `${lockLocation}.claim-1.claimed`;

const now = 1_700_000_000;

const ownLockText = "1700000120";

const expiredLockText = "1700000000";

const liveLockText = "1700000060";

const alreadyHeld = fail({ kind: "file-already-exists", location: lockLocation } as const);

const lockDependencies = () => ({
  createPrivateFile: vi.fn<PrivateFileCreator>().mockResolvedValue(succeed(undefined)),
  readTextFile: vi.fn<TextFileReader>(),
  moveFile: vi.fn<FileMover>().mockResolvedValue(succeed(undefined)),
  removeFile: vi.fn<FileRemover>().mockResolvedValue(succeed(undefined)),
  clock: { nowEpochSeconds: vi.fn<ClockPort["nowEpochSeconds"]>().mockReturnValue(now) },
  pause: { pauseMilliseconds: vi.fn<PausePort["pauseMilliseconds"]>().mockResolvedValue() },
  createClaimName: vi.fn<() => string>().mockReturnValue("claim-1"),
});

describe("createExclusiveFileLock acquire", () => {
  it("takes the lock by writing its expiry and leaves it held until released", async () => {
    const dependencies = lockDependencies();

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    assert(acquired.kind === "success");
    expect(dependencies.createPrivateFile).toHaveBeenCalledExactlyOnceWith({
      location: lockLocation,
      text: ownLockText,
    });
    expect(dependencies.moveFile).not.toHaveBeenCalled();
  });

  it("waits and tries again while another process holds a live lock", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed(liveLockText));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.pause.pauseMilliseconds).toHaveBeenCalledExactlyOnceWith(250);
    expect(dependencies.createPrivateFile).toHaveBeenCalledTimes(2);
    expect(dependencies.moveFile).not.toHaveBeenCalled();
  });

  it("tries again at once when the lock vanished before it could be read", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(
      fail({ kind: "file-unreadable", location: lockLocation }),
    );

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.moveFile).not.toHaveBeenCalled();
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("gives up after a bounded number of attempts on a lock that stays held", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValue(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed(liveLockText));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired).toEqual(fail({ kind: "lock-unavailable", lockLocation }));
    expect(dependencies.createPrivateFile).toHaveBeenCalledTimes(600);
  });

  it("says the lock cannot be written, not that someone holds it, when the create fails", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValue(
      fail({ kind: "file-unwritable", location: lockLocation, detail: "EACCES" }),
    );

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired).toEqual(fail({ kind: "lock-unwritable", lockLocation, detail: "EACCES" }));
  });
});

describe("createExclusiveFileLock breaking a stale lock", () => {
  it("claims an expired lock under a name of its own and discards it, without waiting", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed(expiredLockText));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.moveFile).toHaveBeenCalledExactlyOnceWith({
      from: lockLocation,
      to: claimLocation,
    });
    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(claimLocation);
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("breaks a lock whose text is not an expiry", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("held by someone"));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(claimLocation);
  });

  it("puts back a fresh lock another waiter took between its read and its claim", async () => {
    const freshLockText = "1700000180";
    const dependencies = lockDependencies();
    dependencies.createPrivateFile
      .mockResolvedValueOnce(alreadyHeld)
      .mockResolvedValueOnce(succeed(undefined))
      .mockResolvedValueOnce(alreadyHeld)
      .mockResolvedValueOnce(succeed(undefined));
    dependencies.readTextFile
      .mockResolvedValueOnce(succeed(expiredLockText))
      .mockResolvedValueOnce(succeed(freshLockText))
      .mockResolvedValueOnce(succeed(freshLockText));

    await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(dependencies.createPrivateFile).toHaveBeenNthCalledWith(2, {
      location: lockLocation,
      text: freshLockText,
    });
    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(claimLocation);
    expect(dependencies.pause.pauseMilliseconds).toHaveBeenCalledExactlyOnceWith(250);
  });

  it("never removes the lock path itself, so it cannot delete a lock it did not read", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed(expiredLockText));

    await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(dependencies.removeFile).not.toHaveBeenCalledWith(lockLocation);
  });

  it("leaves the stale lock to the waiter that claimed it first", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed(expiredLockText));
    dependencies.moveFile.mockResolvedValue(
      fail({ kind: "file-missing", location: lockLocation }),
    );

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.removeFile).not.toHaveBeenCalled();
  });
});

describe("createExclusiveFileLock release", () => {
  it("claims and discards the lock it wrote", async () => {
    const dependencies = lockDependencies();
    dependencies.readTextFile.mockResolvedValue(succeed(ownLockText));
    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);
    assert(acquired.kind === "success");

    await acquired.outcome();

    expect(dependencies.moveFile).toHaveBeenCalledExactlyOnceWith({
      from: lockLocation,
      to: claimLocation,
    });
    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(claimLocation);
    expect(dependencies.createPrivateFile).toHaveBeenCalledOnce();
  });

  it("puts back a lock that is no longer its own, taken over after it expired", async () => {
    const successorLockText = "1700000300";
    const dependencies = lockDependencies();
    dependencies.readTextFile.mockResolvedValue(succeed(successorLockText));
    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);
    assert(acquired.kind === "success");

    await acquired.outcome();

    expect(dependencies.createPrivateFile).toHaveBeenLastCalledWith({
      location: lockLocation,
      text: successorLockText,
    });
    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(claimLocation);
  });
});
