import type { AgentRole } from "../domain/agent-role.ts";
import type { Result } from "../domain/result.ts";
import type { UserGrant } from "../domain/user-grant.ts";
import type { CredentialFailure } from "./credential-store-port.ts";
import type { LockRelease } from "./exclusive-lock-port.ts";

type GrantLocation = { readonly role: AgentRole };

type GrantSaving = GrantLocation & { readonly grant: UserGrant };

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

type UserGrantLockUnwritable = {
  readonly kind: "user-grant-lock-unwritable";
  readonly path: string;
  readonly detail: string;
};

type UserGrantLoadFailure = GrantStoreUnlocatable | UserGrantMissing | UserGrantInvalid;

type UserGrantSaveFailure = GrantStoreUnlocatable | UserGrantUnwritable;

type UserGrantLockFailure =
  | GrantStoreUnlocatable
  | UserGrantLockUnavailable
  | UserGrantLockUnwritable;

type UserGrantStorePort = {
  readonly load: (location: GrantLocation) => Promise<Result<UserGrant, UserGrantLoadFailure>>;
  readonly save: (saving: GrantSaving) => Promise<Result<void, UserGrantSaveFailure>>;
  readonly lock: (location: GrantLocation) => Promise<Result<LockRelease, UserGrantLockFailure>>;
};

export type {
  GrantLocation,
  GrantSaving,
  GrantStoreUnlocatable,
  UserGrantInvalid,
  UserGrantLoadFailure,
  UserGrantLockFailure,
  UserGrantLockUnavailable,
  UserGrantLockUnwritable,
  UserGrantMissing,
  UserGrantSaveFailure,
  UserGrantStorePort,
  UserGrantUnwritable,
};
