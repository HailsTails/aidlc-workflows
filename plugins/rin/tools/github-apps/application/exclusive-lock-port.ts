import type { Result } from "../domain/result.ts";

type LockRelease = () => Promise<void>;

type LockUnavailable = { readonly kind: "lock-unavailable"; readonly lockLocation: string };

type LockUnwritable = {
  readonly kind: "lock-unwritable";
  readonly lockLocation: string;
  readonly detail: string;
};

type LockFailure = LockUnavailable | LockUnwritable;

type ExclusiveLockPort = {
  readonly acquire: (lockLocation: string) => Promise<Result<LockRelease, LockFailure>>;
};

export type { ExclusiveLockPort, LockFailure, LockRelease, LockUnavailable, LockUnwritable };
