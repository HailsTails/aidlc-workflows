import { describe, expect, it, vi } from "vitest";
import type { ClockPort } from "../application/clock-port.ts";
import type { PausePort } from "../application/pause-port.ts";
import type { FileRemover, PrivateFileCreator } from "../application/private-file-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import { fail, succeed } from "../domain/result.ts";
import { createExclusiveFileLock } from "./exclusive-file-lock.ts";

const lockLocation = "C:/Users/helen/.config/rin-github-apps/rin-author.user-grant.lock";

const now = 1_700_000_000;

const alreadyHeld = fail({ kind: "file-already-exists", location: lockLocation });

const lockDependencies = () => ({
  createPrivateFile: vi.fn<PrivateFileCreator>().mockResolvedValue(succeed(undefined)),
  readTextFile: vi.fn<TextFileReader>(),
  removeFile: vi.fn<FileRemover>().mockResolvedValue(succeed(undefined)),
  clock: { nowEpochSeconds: vi.fn<ClockPort["nowEpochSeconds"]>().mockReturnValue(now) },
  pause: { pauseMilliseconds: vi.fn<PausePort["pauseMilliseconds"]>().mockResolvedValue() },
});

describe("createExclusiveFileLock", () => {
  it("takes the lock with its expiry, runs the work, then releases the lock", async () => {
    const dependencies = lockDependencies();
    const work = vi.fn<() => Promise<string>>().mockResolvedValue("refreshed");

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work,
    });

    expect(held).toEqual(succeed("refreshed"));
    expect(dependencies.createPrivateFile).toHaveBeenCalledWith({
      location: lockLocation,
      text: "1700000120",
    });
    expect(dependencies.removeFile).toHaveBeenCalledWith(lockLocation);
    expect(work.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.removeFile.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("waits and tries again while another process holds a live lock", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("1700000060"));
    const work = vi.fn<() => Promise<string>>().mockResolvedValue("refreshed");

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work,
    });

    expect(held).toEqual(succeed("refreshed"));
    expect(dependencies.pause.pauseMilliseconds).toHaveBeenCalledWith(250);
    expect(dependencies.removeFile).toHaveBeenCalledOnce();
    expect(work).toHaveBeenCalledOnce();
  });

  it("breaks a lock whose holder let it expire, without waiting", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("1700000000"));

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work: async () => "refreshed",
    });

    expect(held).toEqual(succeed("refreshed"));
    expect(dependencies.removeFile).toHaveBeenCalledTimes(2);
    expect(dependencies.createPrivateFile).toHaveBeenCalledTimes(2);
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("breaks a lock whose text is not an expiry", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("held by someone"));

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work: async () => "refreshed",
    });

    expect(held).toEqual(succeed("refreshed"));
    expect(dependencies.removeFile).toHaveBeenCalledTimes(2);
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("tries again at once when the lock vanished before it could be read", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValueOnce(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(
      fail({ kind: "file-unreadable", location: lockLocation }),
    );

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work: async () => "refreshed",
    });

    expect(held).toEqual(succeed("refreshed"));
    expect(dependencies.removeFile).toHaveBeenCalledOnce();
    expect(dependencies.pause.pauseMilliseconds).not.toHaveBeenCalled();
  });

  it("releases the lock when the work's outcome is a failure", async () => {
    const dependencies = lockDependencies();
    const refusal = fail({ kind: "refresh-refused" });

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work: async () => refusal,
    });

    expect(held).toEqual(succeed(refusal));
    expect(dependencies.removeFile).toHaveBeenCalledWith(lockLocation);
  });

  it("gives up after a bounded number of attempts on a lock that stays held", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValue(alreadyHeld);
    dependencies.readTextFile.mockResolvedValue(succeed("1700000060"));
    const work = vi.fn<() => Promise<string>>();

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work,
    });

    expect(held).toEqual(fail({ kind: "lock-unavailable", lockLocation }));
    expect(dependencies.createPrivateFile).toHaveBeenCalledTimes(480);
    expect(work).not.toHaveBeenCalled();
  });

  it("reports the lock unavailable when it cannot be written", async () => {
    const dependencies = lockDependencies();
    dependencies.createPrivateFile.mockResolvedValue(
      fail({ kind: "file-unwritable", location: lockLocation, detail: "EACCES" }),
    );
    const work = vi.fn<() => Promise<string>>();

    const held = await createExclusiveFileLock(dependencies).holdExclusively({
      lockLocation,
      work,
    });

    expect(held).toEqual(fail({ kind: "lock-unavailable", lockLocation }));
    expect(work).not.toHaveBeenCalled();
    expect(dependencies.removeFile).not.toHaveBeenCalled();
  });
});
