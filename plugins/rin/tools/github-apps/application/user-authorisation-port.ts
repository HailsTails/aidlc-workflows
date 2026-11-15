import type { Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import type { IssuedUserGrant } from "../domain/user-grant.ts";
import type { GitHubFailure } from "./github-failure.ts";

type DeviceCodeRequest = { readonly clientId: string };

type DeviceAuthorisation = {
  readonly deviceCode: Secret;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresInSeconds: number;
  readonly pollIntervalSeconds: number;
};

type DeviceCodeRedemption = { readonly clientId: string; readonly deviceCode: Secret };

type DeviceCodePoll =
  | { readonly kind: "granted"; readonly issued: IssuedUserGrant }
  | { readonly kind: "pending" }
  | { readonly kind: "slow-down"; readonly pollIntervalSeconds: number };

type GrantRefresh = { readonly clientId: string; readonly refreshToken: Secret };

type UserAuthorisationRefused =
  | { readonly kind: "device-flow-disabled" }
  | { readonly kind: "oauth-client-rejected" }
  | {
      readonly kind: "oauth-request-refused";
      readonly operation: string;
      readonly error: string;
      readonly description: string;
    };

type DeviceCodeRefused =
  | { readonly kind: "device-code-expired" }
  | { readonly kind: "device-authorisation-denied" };

type RefreshTokenRejected = { readonly kind: "refresh-token-rejected" };

type UserAuthorisationFailure = GitHubFailure | UserAuthorisationRefused;

type UserAuthorisationPort = {
  readonly requestDeviceCode: (
    request: DeviceCodeRequest,
  ) => Promise<Result<DeviceAuthorisation, UserAuthorisationFailure>>;
  readonly redeemDeviceCode: (
    redemption: DeviceCodeRedemption,
  ) => Promise<Result<DeviceCodePoll, UserAuthorisationFailure | DeviceCodeRefused>>;
  readonly refreshGrant: (
    refresh: GrantRefresh,
  ) => Promise<Result<IssuedUserGrant, UserAuthorisationFailure | RefreshTokenRejected>>;
};

export type {
  DeviceAuthorisation,
  DeviceCodePoll,
  DeviceCodeRedemption,
  DeviceCodeRefused,
  DeviceCodeRequest,
  GrantRefresh,
  RefreshTokenRejected,
  UserAuthorisationFailure,
  UserAuthorisationPort,
  UserAuthorisationRefused,
};
