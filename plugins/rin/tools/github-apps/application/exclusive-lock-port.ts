import type { Result } from "../domain/result.ts";

type LockRelease = () => Promise<void>;

type LockUnavailable = { readonly kind: "lock-unavailable"; readonly lockLocation: string };

type ExclusiveLockPort = {
  readonly acquire: (lockLocation: string) => Promise<Result<LockRelease, LockUnavailable>>;
};

export type { ExclusiveLockPort, LockRelease, LockUnavailable };
