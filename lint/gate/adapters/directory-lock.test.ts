import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { basename, join } from "node:path";
import type { FreeMemory, MachineLock } from "../application/ports.ts";
import { ticketName } from "../domain/machine-lock.ts";
import { directoryLock } from "./directory-lock.ts";

const SANDBOX = join(import.meta.dir, "../../../.cache/gate-tests", randomUUID());
const MEGABYTE = 1024 * 1024;
const PLENTY: FreeMemory = { bytes: () => 16_000 * MEGABYTE };
const SCARCE: FreeMemory = { bytes: () => 1_000 * MEGABYTE };
const REQUEST = { lane: "G", command: "gate full", waitMs: 0 };
const EXITED_PID = Bun.spawnSync(["git", "--version"]).pid;

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

const lockFolder = (name: string): string => {
  const directory = join(SANDBOX, name);
  mkdirSync(directory, { recursive: true });
  return directory;
};

const lockIn = (directory: string, memory: FreeMemory): MachineLock =>
  directoryLock({
    directory,
    cwd: SANDBOX,
    onWait: () => undefined,
    policy: { slots: 3, minFreeMb: 4096 },
    memory,
  });

type HeldSlot = { readonly directory: string; readonly name: string; readonly pid: number };

const holdSlot = (slot: HeldSlot): void => {
  const path = join(slot.directory, slot.name);
  mkdirSync(path);
  const owner = { pid: slot.pid, host: hostname(), lane: "D", command: "gate full", startedAt: 1 };
  writeFileSync(join(path, "owner.json"), JSON.stringify({ ...owner, cwd: SANDBOX }));
};

const ownerPidOf = (directory: string, name: string): number =>
  JSON.parse(readFileSync(join(directory, name, "owner.json"), "utf8")).pid;

const waitInQueue = (directory: string, pid: number): void => {
  const ticket = join(directory, "queue", ticketName(1, `earlier-${pid}`));
  mkdirSync(ticket, { recursive: true });
  const owner = { pid, host: hostname(), lane: "W", command: "gate full", startedAt: 1 };
  writeFileSync(join(ticket, "owner.json"), JSON.stringify({ ...owner, cwd: SANDBOX }));
};

const ownerOf = (directory: string, name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(directory, name, "owner.json"), "utf8"));

describe("directoryLock queue", () => {
  test("a newcomer cannot take a free slot ahead of an earlier live waiter", async () => {
    const directory = lockFolder("overtake");
    waitInQueue(directory, process.pid);

    const outcome = await lockIn(directory, PLENTY).acquire(REQUEST);

    expect(outcome).toEqual({ acquired: false, reason: "waiting for its turn" });
  });

  test("a waiter whose process has gone does not hold up the queue", async () => {
    const directory = lockFolder("departed");
    waitInQueue(directory, EXITED_PID);
    const lock = lockIn(directory, PLENTY);

    const outcome = await lock.acquire(REQUEST);

    expect(outcome).toEqual({ acquired: true });
    lock.release();
  });

  test("a job that gives up leaves no place in the queue", async () => {
    const directory = lockFolder("gave-up");
    holdSlot({ directory, name: "heavy-1.lock", pid: process.pid });
    holdSlot({ directory, name: "heavy-2.lock", pid: process.pid });
    holdSlot({ directory, name: "heavy-3.lock", pid: process.pid });

    await lockIn(directory, PLENTY).acquire(REQUEST);

    expect(readdirSync(join(directory, "queue"))).toEqual([]);
  });
});

describe("directoryLock owner record", () => {
  test("it names the caller working directory, and the lane falls back to its folder name", async () => {
    const directory = lockFolder("identity");
    const lock = lockIn(directory, PLENTY);

    await lock.acquire({ lane: undefined, command: "gate locked", waitMs: 0 });

    expect(ownerOf(directory, "heavy-1.lock")).toMatchObject({
      cwd: SANDBOX,
      lane: basename(SANDBOX),
    });
    lock.release();
  });

  test("a named lane is recorded as given", async () => {
    const directory = lockFolder("named");
    const lock = lockIn(directory, PLENTY);

    await lock.acquire({ lane: "G", command: "gate full", waitMs: 0 });

    expect(ownerOf(directory, "heavy-1.lock")).toMatchObject({ lane: "G" });
    lock.release();
  });
});

describe("directoryLock slots", () => {
  test("a fourth job waits while three live jobs hold every slot", async () => {
    const directory = lockFolder("full");
    holdSlot({ directory, name: "heavy-1.lock", pid: process.pid });
    holdSlot({ directory, name: "heavy-2.lock", pid: process.pid });
    holdSlot({ directory, name: "heavy-3.lock", pid: process.pid });

    const outcome = await lockIn(directory, PLENTY).acquire(REQUEST);

    expect(outcome).toEqual({ acquired: false, reason: "no free slot" });
  });

  test("a job waits while free memory is below the floor, and takes no slot", async () => {
    const directory = lockFolder("scarce");

    const outcome = await lockIn(directory, SCARCE).acquire(REQUEST);

    expect(outcome).toEqual({ acquired: false, reason: "free memory below floor" });
  });

  test("a stale owner in any slot is reclaimed", async () => {
    const directory = lockFolder("stale");
    holdSlot({ directory, name: "heavy-1.lock", pid: process.pid });
    holdSlot({ directory, name: "heavy-2.lock", pid: EXITED_PID });
    holdSlot({ directory, name: "heavy-3.lock", pid: process.pid });
    const lock = lockIn(directory, PLENTY);

    const outcome = await lock.acquire({ ...REQUEST, lane: "G" });

    expect(outcome).toEqual({ acquired: true });
    expect(ownerPidOf(directory, "heavy-2.lock")).toBe(process.pid);
    lock.release();
  });
});
