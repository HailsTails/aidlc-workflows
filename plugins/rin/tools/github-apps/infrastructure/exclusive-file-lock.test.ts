import { assert, describe, expect, it, vi } from "vitest";
import type { ClockPort } from "../application/clock-port.ts";
import type { PausePort } from "../application/pause-port.ts";
import type { FileRemover, PrivateFileCreator } from "../application/private-file-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed } from "../domain/result.ts";
import { createExclusiveFileLock } from "./exclusive-file-lock.ts";

const lockLocation = "C:/Users/helen/.config/rin-github-apps/author.user-grant.lock";

const now = 1_700_000_000;

const alreadyHeld = fail({ kind: "file-already-exists", location: lockLocation } as const);

const lockDependencies = () => ({
  createPrivateFile: vi.fn<PrivateFileCreator>().mockResolvedValue(succeed(undefined)),
  readTextFile: vi.fn<TextFileReader>(),
  removeFile: vi.fn<FileRemover>().mockResolvedValue(succeed(undefined)),
  clock: { nowEpochSeconds: vi.fn<ClockPort["nowEpochSeconds"]>().mockReturnValue(now) },
  pause: { pauseMilliseconds: vi.fn<PausePort["pauseMilliseconds"]>().mockResolvedValue() },
});

describe("createExclusiveFileLock", () => {
  it("takes the lock by writing its expiry and leaves it held until released", async () => {
    const dependencies = lockDependencies();

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    assert(acquired.kind === "success");
    expect(dependencies.createPrivateFile).toHaveBeenCalledExactlyOnceWith({
      location: lockLocation,
      text: "1700000120",
    });
    expect(dependencies.removeFile).not.toHaveBeenCalled();
  });

  it("removes the lock file when the holder releases it", async () => {
    const dependencies = lockDependencies();
    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);
    assert(acquired.kind === "success");

    await acquired.outcome();

    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(lockLocation);
  });

  it("waits and tries again while another process holds a live lock", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("1700000060"));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.pause.pauseMilliseconds).toHaveBeenCalledExactlyOnceWith(250);
    expect(dependencies.createPrivateFile).toHaveBeenCalledTimes(2);
    expect(dependencies.removeFile).not.toHaveBeenCalled();
  });

  it("breaks a lock whose holder let it expire, without waiting", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("1700000000"));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(lockLocation);
    expect(dependencies.createPrivateFile).toHaveBeenCalledTimes(2);
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("breaks a lock whose text is not an expiry", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("held by someone"));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.removeFile).toHaveBeenCalledExactlyOnceWith(lockLocation);
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("tries again at once when the lock vanished before it could be read", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(
      fail({ kind: "file-unreadable", location: lockLocation }),
    );

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired.kind).toBe("success");
    expect(dependencies.removeFile).not.toHaveBeenCalled();
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("gives up after a bounded number of attempts on a lock that stays held", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValue(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("1700000060"));

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired).toEqual(fail({ kind: "lock-unavailable", lockLocation }));
    expect(dependencies.createPrivateFile).toHaveBeenCalledTimes(480);
  });

  it("reports the lock unavailable when it cannot be written", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValue(
      fail({ kind: "file-unwritable", location: lockLocation, detail: "EACCES" }),
    );

    const acquired = await createExclusiveFileLock(dependencies).acquire(lockLocation);

    expect(acquired).toEqual(fail({ kind: "lock-unavailable", lockLocation }));
    expect(dependencies.removeFile).not.toHaveBeenCalled();
  });
});
