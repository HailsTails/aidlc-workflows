import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import type { FreeMemory, MachineLock } from "../application/ports.ts";
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
