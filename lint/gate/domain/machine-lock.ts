export type LockOwner = {
  readonly pid: number;
  readonly host: string;
  readonly lane: string;
  readonly command: string;
  readonly cwd: string;
  readonly startedAt: number;
};

export type LockObservation = {
  readonly owner: LockOwner | undefined;
  readonly ageMs: number;
  readonly ownerAlive: boolean;
  readonly host: string;
};

export type SlotPolicy = {
  readonly slots: number;
  readonly minFreeMb: number;
};

export type WaitReason = "no free slot" | "free memory below floor" | "waiting for its turn";

export const DEFAULT_SLOT_POLICY: SlotPolicy = { slots: 3, minFreeMb: 4096 };

const BYTES_PER_MB = 1024 * 1024;

export const megabytesOf = (bytes: number): number => Math.floor(bytes / BYTES_PER_MB);

export const memoryAdmits = (policy: SlotPolicy, freeBytes: number): boolean =>
  megabytesOf(freeBytes) >= policy.minFreeMb;

export const slotNames = (policy: SlotPolicy): readonly string[] =>
  Array.from({ length: policy.slots }, (_, index) => `heavy-${index + 1}.lock`);

export const LOCK_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export const UNREADABLE_OWNER_GRACE_MS = 60 * 1000;

export const LOCK_POLL_MS = 5000;

export const isStale = (observation: LockObservation): boolean => {
  const { owner, ageMs } = observation;
  if (owner === undefined) {
    return ageMs > UNREADABLE_OWNER_GRACE_MS;
  }
  return owner.host === observation.host ? !observation.ownerAlive : ageMs > LOCK_MAX_AGE_MS;
};

export const describeOwner = (owner: LockOwner | undefined): string =>
  owner === undefined
    ? "an unknown holder"
    : `pid ${owner.pid} on ${owner.host} (lane ${owner.lane}: ${owner.command}) in ${owner.cwd}`;

const TICKET_DIGITS = 15;

export const ticketName = (arrivedAt: number, unique: string): string =>
  `${String(arrivedAt).padStart(TICKET_DIGITS, "0")}-${unique}`;

export const ticketsAhead = (names: readonly string[], mine: string): readonly string[] =>
  [...names].sort().filter((name) => name < mine);
