import type { AgentRole } from "../domain/agent-role.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import { assessGrantFreshness, grantIssuedAt, type UserGrant } from "../domain/user-grant.ts";
import type { ClockPort } from "./clock-port.ts";
import type {
  CredentialFailure,
  UserAuthorisationSettingsPort,
  UserAuthorisationUnconfigured,
} from "./credential-store-port.ts";
import type {
  RefreshTokenRejected,
  UserAuthorisationFailure,
  UserAuthorisationPort,
} from "./user-authorisation-port.ts";
import type {
  UserGrantLoadFailure,
  UserGrantLockFailure,
  UserGrantSaveFailure,
  UserGrantStorePort,
} from "./user-grant-store-port.ts";

type UserTokenMintingDependencies = {
  readonly authorisationSettings: UserAuthorisationSettingsPort;
  readonly userAuthorisation: UserAuthorisationPort;
  readonly userGrantStore: UserGrantStorePort;
  readonly clock: ClockPort;
};

type UserTokenRequest = { readonly role: AgentRole };

type UserGrantExpired = { readonly kind: "user-grant-expired" };

type UserTokenFailure =
  | CredentialFailure
  | UserAuthorisationUnconfigured
  | UserGrantLoadFailure
  | UserGrantLockFailure
  | UserGrantSaveFailure
  | UserGrantExpired
  | UserAuthorisationFailure
  | RefreshTokenRejected;

type UserTokenOutcome = Promise<Result<Secret, UserTokenFailure>>;

type UserTokenMinter = {
  readonly mintUserToken: (request: UserTokenRequest) => UserTokenOutcome;
};

type GrantRenewal = UserTokenMintingDependencies & {
  readonly role: AgentRole;
  readonly clientId: string;
};

type StaleGrant = GrantRenewal & { readonly grant: UserGrant };

type StoredGrantReading = Pick<UserTokenMintingDependencies, "userGrantStore" | "clock"> & {
  readonly role: AgentRole;
  readonly renew: (grant: UserGrant) => UserTokenOutcome;
};

type RejectedRefresh = Pick<UserTokenMintingDependencies, "userGrantStore" | "clock"> & {
  readonly role: AgentRole;
  readonly rejected: UserGrant;
};

type ExclusiveRenewal = {
  readonly dependencies: UserTokenMintingDependencies;
  readonly request: UserTokenRequest;
};

const tokenFromStoredGrant = async ({
  userGrantStore,
  clock,
  role,
  renew,
}: StoredGrantReading): UserTokenOutcome => {
  const grant = await userGrantStore.load({ role });
  if (grant.kind === "failure") return grant;
  const freshness = assessGrantFreshness({
    grant: grant.outcome,
    nowEpochSeconds: clock.nowEpochSeconds(),
  });
  switch (freshness) {
    case "usable":
      return succeed(grant.outcome.accessToken);
    case "expired":
      return fail({ kind: "user-grant-expired" });
    case "refreshable":
      return renew(grant.outcome);
  }
};

const tokenRenewedElsewhere = async ({
  userGrantStore,
  clock,
  role,
  rejected,
}: RejectedRefresh): UserTokenOutcome => {
  const stored = await userGrantStore.load({ role });
  if (stored.kind === "failure") return stored;
  const replaced = stored.outcome.refreshToken.reveal() !== rejected.refreshToken.reveal();
  const freshness = assessGrantFreshness({
    grant: stored.outcome,
    nowEpochSeconds: clock.nowEpochSeconds(),
  });
  return replaced && freshness === "usable"
    ? succeed(stored.outcome.accessToken)
    : fail({ kind: "refresh-token-rejected" });
};

const renewGrant = async ({
  userAuthorisation,
  userGrantStore,
  clock,
  role,
  clientId,
  grant,
}: StaleGrant): UserTokenOutcome => {
  const issued = await userAuthorisation.refreshGrant({
    clientId,
    refreshToken: grant.refreshToken,
  });
  if (issued.kind === "failure") {
    return issued.reason.kind === "refresh-token-rejected"
      ? tokenRenewedElsewhere({ userGrantStore, clock, role, rejected: grant })
      : issued;
  }
  const renewed = grantIssuedAt({
    issued: issued.outcome,
    nowEpochSeconds: clock.nowEpochSeconds(),
  });
  const saved = await userGrantStore.save({ role, grant: renewed });
  if (saved.kind === "failure") return saved;
  return succeed(renewed.accessToken);
};

const renewExclusively = async ({ dependencies, request }: ExclusiveRenewal): UserTokenOutcome => {
  const { role } = request;
  const settings = await dependencies.authorisationSettings.loadUserAuthorisationSettings({ role });
  if (settings.kind === "failure") return settings;
  const renewal = { ...dependencies, role, clientId: settings.outcome.clientId };
  const lock = await dependencies.userGrantStore.lock({ role });
  if (lock.kind === "failure") return lock;
  const token = await tokenFromStoredGrant({
    ...renewal,
    renew: (grant) => renewGrant({ ...renewal, grant }),
  });
  await lock.outcome();
  return token;
};

const createUserTokenMinter = (dependencies: UserTokenMintingDependencies): UserTokenMinter => ({
  mintUserToken: (request) =>
    tokenFromStoredGrant({
      ...dependencies,
      role: request.role,
      renew: () => renewExclusively({ dependencies, request }),
    }),
});

export {
  createUserTokenMinter,
  type UserGrantExpired,
  type UserTokenFailure,
  type UserTokenMinter,
  type UserTokenRequest,
};
