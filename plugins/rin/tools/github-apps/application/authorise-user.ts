import type { AgentRole } from "../domain/agent-role.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import { grantIssuedAt, type IssuedUserGrant, type UserGrant } from "../domain/user-grant.ts";
import type { ClockPort } from "./clock-port.ts";
import type {
  CredentialFailure,
  UserAuthorisationSettingsPort,
  UserAuthorisationUnconfigured,
} from "./credential-store-port.ts";
import type { PausePort } from "./pause-port.ts";
import type {
  DeviceCodeRefused,
  UserAuthorisationFailure,
  UserAuthorisationPort,
} from "./user-authorisation-port.ts";
import type {
  UserGrantLockFailure,
  UserGrantSaveFailure,
  UserGrantStorePort,
} from "./user-grant-store-port.ts";

const MILLISECONDS_PER_SECOND = 1000;

type UserAuthorisingDependencies = {
  readonly authorisationSettings: UserAuthorisationSettingsPort;
  readonly userAuthorisation: UserAuthorisationPort;
  readonly userGrantStore: UserGrantStorePort;
  readonly clock: ClockPort;
  readonly pause: PausePort;
};

type DevicePrompt = {
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresInSeconds: number;
};

type UserAuthorisationRequest = {
  readonly role: AgentRole;
  readonly announce: (prompt: DevicePrompt) => void;
};

type AuthorisedUser = {
  readonly accessTokenExpiresAtEpochSeconds: number;
  readonly refreshTokenExpiresAtEpochSeconds: number;
};

type ApprovalFailure = UserAuthorisationFailure | DeviceCodeRefused;

type AuthoriseUserFailure =
  | CredentialFailure
  | UserAuthorisationUnconfigured
  | ApprovalFailure
  | UserGrantLockFailure
  | UserGrantSaveFailure;

type UserAuthoriser = {
  readonly authoriseUser: (
    request: UserAuthorisationRequest,
  ) => Promise<Result<AuthorisedUser, AuthoriseUserFailure>>;
};

type ApprovalWait = Pick<UserAuthorisingDependencies, "userAuthorisation" | "clock" | "pause"> & {
  readonly clientId: string;
  readonly deviceCode: Secret;
  readonly pollIntervalSeconds: number;
  readonly deadlineEpochSeconds: number;
};

type GrantKeeping = Pick<UserAuthorisingDependencies, "userGrantStore"> & {
  readonly role: AgentRole;
  readonly grant: UserGrant;
};

const awaitApproval = async (wait: ApprovalWait): Promise<Result<IssuedUserGrant, ApprovalFailure>> => {
  const { userAuthorisation, clock, pause, clientId, deviceCode } = wait;
  await pause.pauseMilliseconds(wait.pollIntervalSeconds * MILLISECONDS_PER_SECOND);
  if (clock.nowEpochSeconds() >= wait.deadlineEpochSeconds) {
    return fail({ kind: "device-code-expired" });
  }
  const poll = await userAuthorisation.redeemDeviceCode({ clientId, deviceCode });
  if (poll.kind === "failure") return poll;
  switch (poll.outcome.kind) {
    case "granted":
      return succeed(poll.outcome.issued);
    case "pending":
      return awaitApproval(wait);
    case "slow-down":
      return awaitApproval({ ...wait, pollIntervalSeconds: poll.outcome.pollIntervalSeconds });
  }
};

const keepGrant = async ({
  userGrantStore,
  role,
  grant,
}: GrantKeeping): Promise<Result<void, UserGrantLockFailure | UserGrantSaveFailure>> => {
  const lock = await userGrantStore.lock({ role });
  if (lock.kind === "failure") return lock;
  const saved = await userGrantStore.save({ role, grant });
  await lock.outcome();
  return saved;
};

const createUserAuthoriser = (dependencies: UserAuthorisingDependencies): UserAuthoriser => ({
  authoriseUser: async ({ role, announce }) => {
    const { authorisationSettings, userAuthorisation, clock } = dependencies;
    const settings = await authorisationSettings.loadUserAuthorisationSettings({ role });
    if (settings.kind === "failure") return settings;
    const { clientId, scope } = settings.outcome;
    const device = await userAuthorisation.requestDeviceCode({ clientId, scope });
    if (device.kind === "failure") return device;
    const { deviceCode, userCode, verificationUri, expiresInSeconds } = device.outcome;
    announce({ userCode, verificationUri, expiresInSeconds });
    const issued = await awaitApproval({
      ...dependencies,
      clientId,
      deviceCode,
      pollIntervalSeconds: device.outcome.pollIntervalSeconds,
      deadlineEpochSeconds: clock.nowEpochSeconds() + expiresInSeconds,
    });
    if (issued.kind === "failure") return issued;
    const grant = grantIssuedAt({ issued: issued.outcome, nowEpochSeconds: clock.nowEpochSeconds() });
    const kept = await keepGrant({ ...dependencies, role, grant });
    if (kept.kind === "failure") return kept;
    return succeed({
      accessTokenExpiresAtEpochSeconds: grant.accessTokenExpiresAtEpochSeconds,
      refreshTokenExpiresAtEpochSeconds: grant.refreshTokenExpiresAtEpochSeconds,
    });
  },
});

export {
  createUserAuthoriser,
  type AuthoriseUserFailure,
  type DevicePrompt,
  type UserAuthoriser,
};
