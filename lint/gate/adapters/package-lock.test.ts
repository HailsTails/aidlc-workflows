import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquirePackageLock, processExists, type PackageLockOptions } from "./package-lock.ts";

const EXITED = 555;

const RECLAIM_NOTE = "reclaimed the projection regeneration lock left by exited process 555\n";

type Fixture = {
  root: string;
  clock: number;
  reports: string[];
};

const fixture: Fixture = { root: "", clock: 0, reports: [] };

const lockPath = (): string => join(fixture.root, "test-package.lock");

const ownerFile = (): string => join(lockPath(), "owner.pid");

beforeEach(() => {
  fixture.root = mkdtempSync(join(tmpdir(), "package-lock-"));
  fixture.clock = 0;
  fixture.reports = [];
});

afterEach(() => rmSync(fixture.root, { recursive: true, force: true }));

const everyoneAlive = (): boolean => true;

const onlyTheExitedGone = (pid: number): boolean => pid !== EXITED;

const contender = (alive: (pid: number) => boolean, pid = 100): PackageLockOptions => ({
  lockPath: lockPath(),
  pid,
  isProcessAlive: alive,
  now: () => fixture.clock,
  sleep: (milliseconds) => {
    fixture.clock += milliseconds;
  },
  timeoutMs: 1_000,
  report: (line) => fixture.reports.push(line),
});

const leaveLockOwnedBy = (pid: number): void => {
  mkdirSync(lockPath());
  writeFileSync(ownerFile(), String(pid));
};

describe("a free lock", () => {
  test("is taken, names its owner and is released", () => {
    const outcome = acquirePackageLock(contender(everyoneAlive));

    expect(outcome.kind).toBe("held");
    expect(readFileSync(ownerFile(), "utf8")).toBe("100");
    if (outcome.kind === "held") outcome.release();
    expect(existsSync(lockPath())).toBe(false);
  });
});

describe("a lock left by an exited owner", () => {
  test("is reclaimed at once, with a one-line note", () => {
    leaveLockOwnedBy(EXITED);

    const outcome = acquirePackageLock(contender(onlyTheExitedGone));

    expect(outcome.kind).toBe("held");
    expect(fixture.clock).toBe(0);
    expect(fixture.reports).toEqual([RECLAIM_NOTE]);
  });

  test("is held by one of two contenders only", () => {
    leaveLockOwnedBy(EXITED);

    const first = acquirePackageLock(contender(onlyTheExitedGone, 100));
    const second = acquirePackageLock(contender(onlyTheExitedGone, 200));

    expect([first.kind, second.kind]).toEqual(["held", "timed-out"]);
    expect(readFileSync(ownerFile(), "utf8")).toBe("100");
  });

  test("waits while another contender is reclaiming it", () => {
    leaveLockOwnedBy(EXITED);
    mkdirSync(`${lockPath()}.reclaim`);

    const outcome = acquirePackageLock(contender(onlyTheExitedGone));

    expect(outcome.kind).toBe("timed-out");
    expect(existsSync(lockPath())).toBe(true);
  });
});

describe("a lock that is still wanted", () => {
  test("a live owner's lock waits until the timeout", () => {
    leaveLockOwnedBy(EXITED);

    const outcome = acquirePackageLock(contender(everyoneAlive));

    expect(outcome.kind).toBe("timed-out");
    expect(fixture.clock).toBeGreaterThanOrEqual(1_000);
    expect(existsSync(lockPath())).toBe(true);
    expect(fixture.reports).toEqual([]);
  });

  test("an empty lock waits, because empty alone never counts as dead", () => {
    mkdirSync(lockPath());

    const outcome = acquirePackageLock(contender(() => false));

    expect(outcome.kind).toBe("timed-out");
    expect(existsSync(lockPath())).toBe(true);
  });
});

describe("processExists", () => {
  test("sees this process and not an exited one", () => {
    expect(processExists(process.pid)).toBe(true);
    expect(processExists(2_147_483_646)).toBe(false);
  });
});
