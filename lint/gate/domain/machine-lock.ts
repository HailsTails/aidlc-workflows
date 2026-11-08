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

export const LOCK_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export const UNREADABLE_OWNER_GRACE_MS = 60 * 1000;

export const LOCK_POLL_MS = 5000;

export const isStale = (observation: LockObservation): boolean => {
  const { owner, ageMs } = observation;
  if (owner === undefined) {
    return ageMs > UNREADABLE_OWNER_GRACE_MS;
  }
  const deadOnThisHost = owner.host === observation.host && !observation.ownerAlive;
  return deadOnThisHost || ageMs > LOCK_MAX_AGE_MS;
};

export const describeOwner = (owner: LockOwner | undefined): string =>
  owner === undefined
    ? "an unknown holder"
    : `pid ${owner.pid} on ${owner.host} (lane ${owner.lane}: ${owner.command}) in ${owner.cwd}`;
