import type { Result } from "../domain/result.ts";

type ExclusiveWork<Outcome> = {
  readonly lockLocation: string;
  readonly work: () => Promise<Outcome>;
};

type LockUnavailable = { readonly kind: "lock-unavailable"; readonly lockLocation: string };

type ExclusiveLockPort = {
  readonly holdExclusively: <Outcome>(
    exclusive: ExclusiveWork<Outcome>,
  ) => Promise<Result<Outcome, LockUnavailable>>;
};

export type { ExclusiveLockPort, ExclusiveWork, LockUnavailable };
