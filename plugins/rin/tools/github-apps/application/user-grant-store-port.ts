import type { Result } from "../domain/result.ts";
import type { UserGrant } from "../domain/user-grant.ts";
import type { CredentialFailure } from "./credential-store-port.ts";

type GrantLocation = { readonly appSlug: string };

type GrantSaving = GrantLocation & { readonly grant: UserGrant };

type ExclusiveGrantWork<Outcome> = GrantLocation & { readonly work: () => Promise<Outcome> };

type GrantStoreUnlocatable = Extract<
  CredentialFailure,
  { readonly kind: "credential-store-unlocatable" }
>;

type UserGrantMissing = { readonly kind: "user-grant-missing"; readonly path: string };

type UserGrantInvalid = {
  readonly kind: "user-grant-invalid";
  readonly path: string;
  readonly issues: string;
};

type UserGrantUnwritable = {
  readonly kind: "user-grant-unwritable";
  readonly path: string;
  readonly detail: string;
};

type UserGrantLockUnavailable = {
  readonly kind: "user-grant-lock-unavailable";
  readonly path: string;
};

type UserGrantLoadFailure = GrantStoreUnlocatable | UserGrantMissing | UserGrantInvalid;

type UserGrantSaveFailure = GrantStoreUnlocatable | UserGrantUnwritable;

type UserGrantLockFailure = GrantStoreUnlocatable | UserGrantLockUnavailable;

type UserGrantStorePort = {
  readonly load: (location: GrantLocation) => Promise<Result<UserGrant, UserGrantLoadFailure>>;
  readonly save: (saving: GrantSaving) => Promise<Result<void, UserGrantSaveFailure>>;
  readonly holdExclusively: <Outcome>(
    exclusive: ExclusiveGrantWork<Outcome>,
  ) => Promise<Result<Outcome, UserGrantLockFailure>>;
};

export type {
  ExclusiveGrantWork,
  GrantLocation,
  GrantSaving,
  GrantStoreUnlocatable,
  UserGrantInvalid,
  UserGrantLoadFailure,
  UserGrantLockFailure,
  UserGrantLockUnavailable,
  UserGrantMissing,
  UserGrantSaveFailure,
  UserGrantStorePort,
  UserGrantUnwritable,
};
