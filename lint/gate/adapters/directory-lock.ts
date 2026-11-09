import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import {
  describeOwner,
  isStale,
  LOCK_POLL_MS,
  megabytesOf,
  memoryAdmits,
  slotNames,
  ticketName,
  ticketsAhead,
  type LockObservation,
  type LockOwner,
  type SlotPolicy,
  type WaitReason,
} from "../domain/machine-lock.ts";
import type { FreeMemory, LockRequest, MachineLock } from "../application/ports.ts";

export type LockPlacement = {
  readonly directory: string;
  readonly cwd: string;
  readonly onWait: (line: string) => void;
  readonly policy: SlotPolicy;
  readonly memory: FreeMemory;
};

const LockOwnerSchema = z.object({
  pid: z.number().int().positive(),
  host: z.string(),
  lane: z.string(),
  command: z.string(),
  cwd: z.string(),
  startedAt: z.number(),
});

const OWNER_FILE = "owner.json";

const QUEUE_FOLDER = "queue";

const SHARED_LOCK_FOLDER = ".aidlc-gate";

export const besideMainCheckout = (root: string, folder: string): string => {
  const commonDir = Bun.spawnSync(
    ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  const gitDir = commonDir.exitCode === 0 ? commonDir.stdout.toString().trim() : "";
  const mainCheckout = gitDir === "" ? root : dirname(gitDir);
  return join(dirname(mainCheckout), folder);
};

export const lockDirectoryBesideMainCheckout = (root: string): string =>
  besideMainCheckout(root, SHARED_LOCK_FOLDER);

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
};

const readOwner = (lockPath: string): LockOwner | undefined => {
  try {
    return LockOwnerSchema.parse(JSON.parse(readFileSync(join(lockPath, OWNER_FILE), "utf8")));
  } catch {
    return undefined;
  }
};

const observe = (lockPath: string): LockObservation => {
  const owner = readOwner(lockPath);
  const since = owner?.startedAt ?? statSync(lockPath, { throwIfNoEntry: false })?.mtimeMs;
  return {
    owner,
    ageMs: Date.now() - (since ?? Date.now()),
    ownerAlive: owner === undefined ? false : isAlive(owner.pid),
    host: hostname(),
  };
};

const tryCreate = (lockPath: string, owner: LockOwner): boolean => {
  try {
    mkdirSync(lockPath);
  } catch {
    return false;
  }
  writeFileSync(join(lockPath, OWNER_FILE), JSON.stringify(owner, null, 2));
  return true;
};

const releaseIfOurs = (lockPath: string): void => {
  if (readOwner(lockPath)?.pid === process.pid) {
    rmSync(lockPath, { recursive: true, force: true });
  }
};

const holdUntilExit = (lockPath: string): void => {
  const release = (): void => releaseIfOurs(lockPath);
  process.once("exit", release);
  process.once("SIGINT", () => {
    release();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    release();
    process.exit(143);
  });
};

const ownerFor = (placement: LockPlacement, request: LockRequest): LockOwner => ({
  pid: process.pid,
  host: hostname(),
  lane: request.lane ?? basename(placement.cwd),
  command: request.command,
  cwd: placement.cwd,
  startedAt: Date.now(),
});

type Attempt =
  | { readonly kind: "held"; readonly slot: string }
  | { readonly kind: "waiting"; readonly reason: WaitReason; readonly detail: string };

const claim = (slot: string, owner: LockOwner): boolean => {
  if (tryCreate(slot, owner)) {
    return true;
  }
  if (!isStale(observe(slot))) {
    return false;
  }
  rmSync(slot, { recursive: true, force: true });
  return tryCreate(slot, owner);
};

const slotsOf = (placement: LockPlacement): readonly string[] =>
  slotNames(placement.policy).map((name) => join(placement.directory, name));

const holders = (slots: readonly string[]): string =>
  slots.map((slot) => describeOwner(readOwner(slot))).join("; ");

const attempt = (placement: LockPlacement, owner: LockOwner): Attempt => {
  const { policy, memory } = placement;
  const freeBytes = memory.bytes();
  if (!memoryAdmits(policy, freeBytes)) {
    const detail = `${megabytesOf(freeBytes)} MB free, floor ${policy.minFreeMb} MB`;
    return { kind: "waiting", reason: "free memory below floor", detail };
  }
  const slots = slotsOf(placement);
  const slot = slots.find((candidate) => claim(candidate, owner));
  return slot === undefined
    ? { kind: "waiting", reason: "no free slot", detail: holders(slots) }
    : { kind: "held", slot };
};

const queueOf = (placement: LockPlacement): string => join(placement.directory, QUEUE_FOLDER);

const enqueue = (placement: LockPlacement, owner: LockOwner): string => {
  mkdirSync(queueOf(placement), { recursive: true });
  const ticket = join(queueOf(placement), ticketName(owner.startedAt, randomUUID()));
  tryCreate(ticket, owner);
  return ticket;
};

const liveTicketsAhead = (placement: LockPlacement, ticket: string): readonly string[] =>
  ticketsAhead(readdirSync(queueOf(placement)), basename(ticket))
    .map((name) => join(queueOf(placement), name))
    .filter((path) => {
      if (!isStale(observe(path))) {
        return true;
      }
      rmSync(path, { recursive: true, force: true });
      return false;
    });

const turnOf = (placement: LockPlacement, ticket: string, owner: LockOwner): Attempt => {
  const ahead = liveTicketsAhead(placement, ticket);
  return ahead.length === 0
    ? attempt(placement, owner)
    : { kind: "waiting", reason: "waiting for its turn", detail: holders(ahead) };
};

type Waiting = { readonly deadline: number; readonly ticket: string; readonly owner: LockOwner };

const awaitTurn = async (
  placement: LockPlacement,
  waiting: Waiting,
): Promise<{ readonly slot: string } | { readonly reason: WaitReason }> => {
  let announced: WaitReason | undefined;
  for (;;) {
    const result = turnOf(placement, waiting.ticket, waiting.owner);
    if (result.kind === "held") {
      return { slot: result.slot };
    }
    if (Date.now() >= waiting.deadline) {
      return { reason: result.reason };
    }
    if (announced !== result.reason) {
      placement.onWait(`waiting for a machine lock slot: ${result.reason} (${result.detail})`);
      announced = result.reason;
    }
    await Bun.sleep(LOCK_POLL_MS);
  }
};

export const directoryLock = (placement: LockPlacement): MachineLock => {
  let held: string | undefined;
  return {
    acquire: async (request) => {
      mkdirSync(placement.directory, { recursive: true });
      const owner = ownerFor(placement, request);
      const ticket = enqueue(placement, owner);
      try {
        const deadline = Date.now() + request.waitMs;
        const outcome = await awaitTurn(placement, { deadline, ticket, owner });
        if ("reason" in outcome) {
          return { acquired: false, reason: outcome.reason };
        }
        held = outcome.slot;
        holdUntilExit(outcome.slot);
        return { acquired: true };
      } finally {
        rmSync(ticket, { recursive: true, force: true });
      }
    },
    release: () => {
      if (held !== undefined) {
        releaseIfOurs(held);
      }
    },
  };
};
