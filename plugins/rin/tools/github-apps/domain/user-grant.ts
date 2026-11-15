import type { Secret } from "./secret.ts";

const ACCESS_TOKEN_USE_MARGIN_SECONDS = 300;

type UserGrant = {
  readonly accessToken: Secret;
  readonly accessTokenExpiresAtEpochSeconds: number;
  readonly refreshToken: Secret;
  readonly refreshTokenExpiresAtEpochSeconds: number;
};

type IssuedUserGrant = {
  readonly accessToken: Secret;
  readonly accessTokenLifetimeSeconds: number;
  readonly refreshToken: Secret;
  readonly refreshTokenLifetimeSeconds: number;
};

type GrantFreshness = "usable" | "refreshable" | "expired";

type GrantAssessment = { readonly grant: UserGrant; readonly nowEpochSeconds: number };

type GrantIssuance = { readonly issued: IssuedUserGrant; readonly nowEpochSeconds: number };

const assessGrantFreshness = ({ grant, nowEpochSeconds }: GrantAssessment): GrantFreshness => {
  const accessTokenUsableUntil =
    grant.accessTokenExpiresAtEpochSeconds - ACCESS_TOKEN_USE_MARGIN_SECONDS;
  if (nowEpochSeconds < accessTokenUsableUntil) return "usable";
  return nowEpochSeconds < grant.refreshTokenExpiresAtEpochSeconds ? "refreshable" : "expired";
};

const grantIssuedAt = ({ issued, nowEpochSeconds }: GrantIssuance): UserGrant => ({
  accessToken: issued.accessToken,
  accessTokenExpiresAtEpochSeconds: nowEpochSeconds + issued.accessTokenLifetimeSeconds,
  refreshToken: issued.refreshToken,
  refreshTokenExpiresAtEpochSeconds: nowEpochSeconds + issued.refreshTokenLifetimeSeconds,
});

export {
  assessGrantFreshness,
  grantIssuedAt,
  type GrantFreshness,
  type IssuedUserGrant,
  type UserGrant,
};
